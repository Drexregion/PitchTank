import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { PriceHistoryPoint } from '../types/PriceHistory';
import { formatPriceHistoryForChart } from '../lib/priceHistoryUtils';

// Module-level registry: one Supabase channel per founderId, shared across all
// hook instances on the same client. Reference-counted so the channel is removed
// only when the last subscriber unmounts.
type ChannelEntry = {
  channel: ReturnType<typeof supabase.channel>;
  listeners: Set<(point: PriceHistoryPoint) => void>;
};
const channelRegistry = new Map<string, ChannelEntry>();

function subscribeToFounder(
  founderId: string,
  listener: (point: PriceHistoryPoint) => void
): () => void {
  if (!channelRegistry.has(founderId)) {
    const listeners = new Set<(point: PriceHistoryPoint) => void>();
    const channel = supabase
      .channel(`price_history_${founderId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'price_history', filter: `founder_id=eq.${founderId}` },
        (payload) => {
          const newPoint = payload.new as PriceHistoryPoint;
          listeners.forEach((l) => l(newPoint));
        }
      )
      .subscribe();
    channelRegistry.set(founderId, { channel, listeners });
  }

  channelRegistry.get(founderId)!.listeners.add(listener);

  return () => {
    const entry = channelRegistry.get(founderId);
    if (!entry) return;
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0) {
      supabase.removeChannel(entry.channel);
      channelRegistry.delete(founderId);
    }
  };
}

type UsePriceHistoryOptions = {
  founderId?: string;
  since?: string;
  until?: string;
  maxPoints?: number;
};

/**
 * Hook to fetch and subscribe to price history for a founder.
 * All instances for the same founderId share a single Supabase channel.
 */
export function usePriceHistory({
  founderId,
  since,
  until,
  maxPoints = 1000,
}: UsePriceHistoryOptions) {
  const [points, setPoints] = useState<PriceHistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!founderId) {
      setPoints([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const fetchPriceHistory = async () => {
      try {
        let query = supabase
          .from('price_history')
          .select('*')
          .eq('founder_id', founderId)
          .order('recorded_at', { ascending: true })
          .limit(maxPoints);

        if (since) query = query.gte('recorded_at', since);
        if (until) query = query.lte('recorded_at', until);

        const { data, error: fetchError } = await query;
        if (fetchError) throw new Error(fetchError.message);

        setPoints(data || []);
        setIsLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch price history');
        setIsLoading(false);
      }
    };

    fetchPriceHistory();

    const unsubscribe = subscribeToFounder(founderId, (newPoint) => {
      setPoints((prev) => {
        const updated = [...prev, newPoint];
        return updated.length > maxPoints ? updated.slice(updated.length - maxPoints) : updated;
      });
    });

    return unsubscribe;
  }, [founderId, since, until, maxPoints]);


  const chartData = formatPriceHistoryForChart(points, maxPoints);

  return { points, chartData, isLoading, error };
}
