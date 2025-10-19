import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { PriceHistoryPoint } from '../types/PriceHistory';
import { formatPriceHistoryForChart } from '../lib/priceHistoryUtils';

type UsePriceHistoryOptions = {
  founderId?: string;
  since?: string;
  until?: string;
  maxPoints?: number;
};

/**
 * Hook to fetch and subscribe to price history for a founder
 */
export function usePriceHistory({
  founderId,
  since,
  until,
  maxPoints = 1000
}: UsePriceHistoryOptions) {
  const [points, setPoints] = useState<PriceHistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Don't fetch anything if no founderId is provided
    if (!founderId) {
      setPoints([]);
      setIsLoading(false);
      return () => {};
    }
    
    setIsLoading(true);
    setError(null);

    // Fetch initial price history data
    const fetchPriceHistory = async () => {
      try {
        let query = supabase
          .from('price_history')
          .select('*')
          .eq('founder_id', founderId)
          .order('recorded_at', { ascending: true })
          .limit(maxPoints);
          
        if (since) {
          query = query.gte('recorded_at', since);
        }
        
        if (until) {
          query = query.lte('recorded_at', until);
        }
        
        const { data, error: fetchError } = await query;
        
        if (fetchError) {
          throw new Error(fetchError.message);
        }
        
        setPoints(data || []);
        setIsLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch price history');
        setIsLoading(false);
      }
    };

    fetchPriceHistory();

    // Set up realtime subscription for new price points
    const channel = supabase.channel(`price_history_${founderId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'price_history',
        filter: `founder_id=eq.${founderId}`
      }, (payload) => {
        const newPoint = payload.new as PriceHistoryPoint;
        
        setPoints(prevPoints => {
          // Add new point to the array
          const updatedPoints = [...prevPoints, newPoint];
          
          // If we exceed maxPoints, remove the oldest points
          if (updatedPoints.length > maxPoints) {
            return updatedPoints.slice(updatedPoints.length - maxPoints);
          }
          
          return updatedPoints;
        });
      })
      .subscribe();

    // Clean up subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, [founderId, since, until, maxPoints]);

  // Prepare chart-friendly data format
  const chartData = formatPriceHistoryForChart(points, maxPoints);

  return { points, chartData, isLoading, error };
}
