import React, { useState, useEffect } from 'react';
import { FounderWithPrice } from '../types/Founder';
import { supabaseUrl } from '../lib/supabaseClient';
import { simulateBuyTrade, simulateSellTrade } from '../lib/ammEngine';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  founder: FounderWithPrice;
  investorId: string;
  investorBalance: number;
  onTradeComplete?: () => void;
}

export const TradeModal: React.FC<TradeModalProps> = ({
  isOpen,
  onClose,
  founder,
  investorId,
  investorBalance,
  onTradeComplete
}) => {
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [shares, setShares] = useState<number>(10);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [resultingPrice, setResultingPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [investorShares, setInvestorShares] = useState<number>(0);
  
  // Reset state when founder changes
  useEffect(() => {
    setTradeType('buy');
    setShares(10);
    setError(null);
    setSuccessMessage(null);
    fetchInvestorShares();
  }, [founder.id, investorId]);
  
  // Fetch how many shares the investor owns of this founder
  const fetchInvestorShares = async () => {
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/investor_holdings?investor_id=eq.${investorId}&founder_id=eq.${founder.id}`,
        {
          method: 'GET',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        setInvestorShares(Number(data[0].shares));
      } else {
        setInvestorShares(0);
      }
    } catch (err) {
      console.error('Error fetching investor shares:', err);
      setInvestorShares(0);
    }
  };
  
  // Update cost estimate when shares or trade type changes
  useEffect(() => {
    if (shares <= 0) {
      setEstimatedCost(0);
      setResultingPrice(0);
      return;
    }
    
    if (tradeType === 'buy') {

      const { cost, resultingPrice, error: simulationError } = simulateBuyTrade(founder, shares);
      if (simulationError) {
        setError(simulationError);
        setEstimatedCost(0);
        setResultingPrice(0);
      } else {
        setError(null);
        setEstimatedCost(cost);
        setResultingPrice(resultingPrice);
      }
    } else {  
      const { payout, resultingPrice, error: simulationError } = simulateSellTrade(founder, shares);
      if (simulationError) {
        setError(simulationError);
        setEstimatedCost(0);
        setResultingPrice(0);
      } else {
        setError(null);
        setEstimatedCost(payout);
        setResultingPrice(resultingPrice);
      }
    }
  }, [shares, tradeType, founder]);
  
  // Execute trade
  const handleTrade = async () => {
    if (shares <= 0) {
      setError('Please enter a valid number of shares');
      return;
    }
    
    // For buy trades, check if investor has enough balance
    if (tradeType === 'buy' && estimatedCost > investorBalance) {
      setError('Insufficient balance to complete this trade');
      return;
    }
    
    // For sell trades, check if investor has enough shares
    if (tradeType === 'sell' && shares > investorShares) {
      setError('You don\'t own enough shares to sell');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      // Call executeTrade edge function
      const response = await fetch(
        `${supabaseUrl}/functions/v1/executeTrade`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            investor_id: investorId,
            founder_id: founder.id,
            shares,
            type: tradeType,
            event_id: founder.event_id
          })
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute trade');
      }
      
      // Update investor shares
      await fetchInvestorShares();
      
      // Show success message
      setSuccessMessage(
        tradeType === 'buy'
          ? `Successfully purchased ${shares} shares for $${estimatedCost.toFixed(2)}`
          : `Successfully sold ${shares} shares for $${estimatedCost.toFixed(2)}`
      );
      
      // Notify parent component
      if (onTradeComplete) {
        onTradeComplete();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while executing the trade');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">
          {tradeType === 'buy' ? 'Buy' : 'Sell'} {founder.name} Shares
        </h2>
        
        <div className="mb-4">
          <p className="text-gray-600 mb-1">Current Price</p>
          <p className="text-xl font-bold">${founder.current_price.toFixed(2)}</p>
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <button
              className={`py-2 px-4 rounded-l-lg w-1/2 ${
                tradeType === 'buy' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-200 text-gray-800'
              }`}
              onClick={() => setTradeType('buy')}
            >
              Buy
            </button>
            <button
              className={`py-2 px-4 rounded-r-lg w-1/2 ${
                tradeType === 'sell' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-200 text-gray-800'
              }`}
              onClick={() => setTradeType('sell')}
              disabled={investorShares <= 0}
            >
              Sell
            </button>
          </div>
          
          {tradeType === 'sell' && investorShares <= 0 && (
            <p className="text-red-500 text-sm mb-2">
              You don't own any shares to sell
            </p>
          )}
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-1">Shares</label>
          <input
            type="number"
            min="1"
            max={tradeType === 'sell' ? investorShares : undefined}
            value={shares}
            onChange={(e) => setShares(parseInt(e.target.value) || 0)}
            className="w-full p-2 border rounded-lg"
          />
          
          {tradeType === 'sell' && (
            <p className="text-sm text-gray-600 mt-1">
              You currently own {investorShares} shares
            </p>
          )}
        </div>
        
        {shares > 0 && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-gray-700">
                {tradeType === 'buy' ? 'Estimated Cost' : 'Estimated Payout'}
              </span>
              <span className="font-bold">
                ${estimatedCost.toFixed(2)}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-700">Resulting Price</span>
              <span className="font-bold">${resultingPrice.toFixed(2)}</span>
            </div>
            
            {tradeType === 'buy' && estimatedCost > investorBalance && (
              <p className="text-red-500 text-sm mt-2">
                Insufficient balance to complete this trade
              </p>
            )}
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg">
            {successMessage}
          </div>
        )}
        
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="mr-2 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
          
          <button
            onClick={handleTrade}
            disabled={
              isLoading || 
              shares <= 0 || 
              (tradeType === 'buy' && estimatedCost > investorBalance) ||
              (tradeType === 'sell' && shares > investorShares)
            }
            className={`py-2 px-4 rounded-lg ${
              isLoading 
                ? 'bg-gray-400 text-white cursor-not-allowed' 
                : tradeType === 'buy'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {isLoading ? 'Processing...' : 'Confirm Trade'}
          </button>
        </div>
      </div>
    </div>
  );
};
