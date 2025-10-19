import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Investor,  InvestorHoldingWithValue } from '../types/Investor';
import { Founder } from '../types/Founder';
import { calculateCurrentPrice } from '../lib/ammEngine';

type UsePortfolioOptions = {
  investorId?: string;
};

/**
 * Hook to fetch and track an investor's portfolio with realtime updates
 */
export function usePortfolio({ investorId }: UsePortfolioOptions) {
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [holdings, setHoldings] = useState<InvestorHoldingWithValue[]>([]);
  const [portfolioValue, setPortfolioValue] = useState<number>(0);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [roiPercent, setRoiPercent] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!investorId) {
      setIsLoading(false);
      return () => {};
    }
    
    setIsLoading(true);
    setError(null);

    const fetchPortfolio = async () => {
      try {
        // Fetch investor information
        const { data: investorData, error: investorError } = await supabase
          .from('investors')
          .select('*')
          .eq('id', investorId)
          .single();
        if (investorError) {
          throw new Error(investorError.message);
        }
        
        // Set investor data
        setInvestor(investorData);
        
        // Fetch investor holdings
        const { data: holdingsData, error: holdingsError } = await supabase
          .from('investor_holdings')
          .select('*')
          .eq('investor_id', investorData.id);

          console.log("holdingsData");
          console.log(holdingsData);

        if (holdingsError) {
          throw new Error(holdingsError.message);
        }
        
        if (!holdingsData || holdingsData.length === 0) {
          setHoldings([]);
          setPortfolioValue(0);
          setTotalValue(Number(investorData.current_balance));
          const roi = (Number(investorData.current_balance) / Number(investorData.initial_balance) - 1) * 100;
          setRoiPercent(roi);
          setIsLoading(false);
          return;
        }
        
        // Fetch founder information for all holdings
        const founderIds = holdingsData.map(holding => holding.founder_id);
        const { data: foundersData, error: foundersError } = await supabase
          .from('founders')
          .select('*')
          .in('id', founderIds);
          
        if (foundersError) {
          throw new Error(foundersError.message);
        }
        
        // Create holdings with calculated values
        const holdingsWithValue: InvestorHoldingWithValue[] = holdingsData.map(holding => {
          const founder = foundersData.find(f => f.id === holding.founder_id) as Founder;
          const currentPrice = founder ? calculateCurrentPrice(founder) : 0;
          const currentValue = Number(holding.shares) * currentPrice;
          const costBasis = Number(holding.cost_basis);
          const profitLoss = currentValue - (Number(holding.shares) * costBasis);
          const holdingRoi = costBasis > 0 ? ((currentPrice / costBasis) - 1) * 100 : 0;


          
          return {
            ...holding,
            founder_name: founder?.name || 'Unknown Founder',
            current_price: currentPrice,
            current_value: currentValue,
            profit_loss: profitLoss,
            roi_percent: holdingRoi
          };
        });
        setHoldings(holdingsWithValue);
        
        // Calculate portfolio metrics
        const portfolioTotalValue = holdingsWithValue.reduce(
          (sum, h) => sum + h.current_value, 
          0
        );
        
        setPortfolioValue(portfolioTotalValue);
        
        const investorTotalValue = portfolioTotalValue + Number(investorData.current_balance);
        setTotalValue(investorTotalValue);
        
        const overallRoi = (investorTotalValue / Number(investorData.initial_balance) - 1) * 100;
        setRoiPercent(overallRoi);
        
        setIsLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch portfolio data');
        setIsLoading(false);
      }
    };

    fetchPortfolio();

    // Set up realtime subscriptions
    const investorChannel = supabase.channel('investor_updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'investors',
        filter: `id=eq.${investorId}`
      }, (payload) => {
        setInvestor(payload.new as Investor);
      })
      .subscribe();

    const holdingsChannel = supabase.channel('holdings_updates')
      .on('postgres_changes', {
        event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
        schema: 'public',
        table: 'investor_holdings',
        filter: `investor_id=eq.${investorId}`
      }, () => {
        // When holdings change, refetch the entire portfolio
        fetchPortfolio();
      })
      .subscribe();

    const foundersChannel = supabase.channel('founders_price_updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'founders'
      }, () => {
        // When any founder changes, refresh the portfolio to update prices
        fetchPortfolio();
      })
      .subscribe();

    // Clean up subscriptions
    return () => {
      supabase.removeChannel(investorChannel);
      supabase.removeChannel(holdingsChannel);
      supabase.removeChannel(foundersChannel);
    };

  }, [investorId]);

  return { 
    investor, 
    holdings, 
    portfolioValue, 
    totalValue, 
    roiPercent, 
    isLoading, 
    error 
  };
}
