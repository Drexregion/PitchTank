import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Founder, FounderWithPrice } from '../types/Founder';
import { calculateCurrentPrice, calculateMarketCap } from '../lib/ammEngine';

type UseRealtimePricesOptions = {
  eventId?: string;
  initialShares?: number;
};

/**
 * Hook to get realtime founder prices using Supabase realtime subscriptions
 */
export function useRealtimePrices({ 
  eventId, 
  initialShares = 100000 
}: UseRealtimePricesOptions) {
  const [founders, setFounders] = useState<FounderWithPrice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state when eventId changes
    setFounders([]);
    setIsLoading(true);
    setError(null);

    // Fetch initial founder data
    const fetchFounders = async () => {
      try {
        let query = supabase
          .from('founders')
          .select('*');
          
        if (eventId) {
          query = query.eq('event_id', eventId);
        }
        
        const { data, error: fetchError } = await query;
        
        if (fetchError) {
          throw new Error(fetchError.message);
        }
        
        if (!data) {
          setFounders([]);
          setIsLoading(false);
          return;
        }
        
        // Calculate current price and market cap for each founder
        const foundersWithPrice: FounderWithPrice[] = data.map(founder => ({
          ...founder,
          current_price: calculateCurrentPrice(founder),
          market_cap: calculateMarketCap(founder, initialShares)
        }));
        
        setFounders(foundersWithPrice);
        setIsLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch founders');
        setIsLoading(false);
      }
    };

    // useEffect(() => {
    //   const interval = setInterval(() => {
    //     fetchFounders();
    //   }, 5000);
    //   return () => clearInterval(interval);
    // }, []);
    fetchFounders();

    // Set up realtime subscription to founder changes
    console.log("eventId");
    console.log(eventId)
    const subscription = supabase
      .channel('founders_changes')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'founders', 
          // ...(eventId ? { filter: `event_id=eq.${eventId}` } : {})
        }, 

        (payload) => {
          // Update the specific founder that changed
          const updatedFounder = payload.new as Founder;
          console.log("updatedFounder");
          console.log(updatedFounder)
          
          setFounders(prevFounders => 
            prevFounders.map(founder => {
              if (founder.id === updatedFounder.id) {
                return {
                  ...updatedFounder,
                  current_price: calculateCurrentPrice(updatedFounder),
                  market_cap: calculateMarketCap(updatedFounder, initialShares)
                };
              }
              return founder;
            })
          );
        }

      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    // Clean up subscription
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [eventId, initialShares]);

  return { founders, isLoading, error, setFounders };
}
