import React, { useState } from 'react';
import { InvestorWithPortfolio, InvestorHoldingWithValue } from '../types/Investor';

interface PortfolioCardProps {
  investor: InvestorWithPortfolio;
  className?: string;
}

export const PortfolioCard: React.FC<PortfolioCardProps> = ({
  investor,
  className = ''
}) => {
  const [showDetails, setShowDetails] = useState<boolean>(false);
  
  // Format currency values
  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };
  
  // Sort holdings by value (highest first)
  const sortedHoldings = [...investor.holdings].sort(
    (a, b) => b.current_value - a.current_value
  );

  return (
    <div className={`bg-white rounded-xl shadow-md overflow-hidden ${className}`}>
      <div className="p-5">
        <h3 className="text-xl font-bold mb-2">Your Portfolio</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-sm text-gray-500">Total Value</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(investor.total_value)}
            </div>
            <div className={`text-sm ${investor.roi_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {investor.roi_percent >= 0 ? '+' : ''}
              {investor.roi_percent.toFixed(2)}%
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-500">Cash Balance</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(investor.current_balance)}
            </div>
            <div className="text-sm text-gray-500">
              {(investor.current_balance / investor.total_value * 100).toFixed(1)}% of portfolio
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold">Holdings</h4>
            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
          
          {investor.holdings.length === 0 ? (
            <div className="text-gray-500 text-center py-4 border-t">
              No investments yet. Start trading to build your portfolio!
            </div>
          ) : (
            <div className="border-t divide-y">
              {sortedHoldings.map((holding) => (
                <div key={holding.id} className="py-3">
                  <div className="flex justify-between">
                    <div className="font-medium">{holding.founder_name}</div>
                    <div className="font-bold">{formatCurrency(holding.current_value)}</div>
                  </div>
                  
                  {showDetails && (
                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <div className="text-gray-500">Shares</div>
                        <div>{holding.shares.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Avg Price</div>
                        <div>${holding.cost_basis.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">P/L</div>
                        <div className={holding.profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {holding.profit_loss >= 0 ? '+' : ''}
                          {formatCurrency(holding.profit_loss)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
