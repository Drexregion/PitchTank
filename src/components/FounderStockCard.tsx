import React, { useState } from 'react';
import { FounderWithPrice } from '../types/Founder';
import { TradeModal } from './TradeModal';
import { FounderPriceChart } from './FounderPriceChart';

interface FounderStockCardProps {
  founder: FounderWithPrice;
  investorId?: string;
  investorBalance?: number;
  onTradeComplete?: () => void;
  showPriceChart?: boolean;
}

export const FounderStockCard: React.FC<FounderStockCardProps> = ({
  founder,
  investorId,
  investorBalance = 0,
  onTradeComplete,
  showPriceChart = true
}) => {
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [showChart, setShowChart] = useState(false);
  
  // Format price with 2 decimal places
  const formattedPrice = founder.current_price.toFixed(2);
  const formattedMarketCap = founder.market_cap.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  
  // Calculate shares owned percentage (1 - (shares_in_pool / initial_shares))
  const initialShares = 100000; // Default from spec
  const sharesOwnedPercent = (1 - (founder.shares_in_pool / initialShares)) * 100;

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {founder.logo_url && (
              <img 
                src={founder.logo_url} 
                alt={`${founder.name} logo`}
                className="w-12 h-12 rounded-full mr-4 object-cover"
              />
            )}
            <div>
              <h3 className="font-bold text-lg text-gray-900">{founder.name}</h3>
              {founder.pitch_summary && (
                <p className="text-sm text-gray-500 line-clamp-2">{founder.pitch_summary}</p>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">${formattedPrice}</div>
            <div className="text-sm text-gray-500">
              <span className={`font-medium ${
                founder.current_price > 10 ? 'text-green-600' : founder.current_price < 10 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {founder.current_price > 10 ? '+' : founder.current_price < 10 ? '' : ''}
                {((founder.current_price / 10 - 1) * 100).toFixed(1)}%
              </span> from IPO
            </div>
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="text-sm">
            <div className="text-gray-500">Market Cap</div>
            <div className="font-medium">{formattedMarketCap}</div>
          </div>
          <div className="text-sm">
            <div className="text-gray-500">Shares Owned</div>
            <div className="font-medium">{sharesOwnedPercent.toFixed(1)}%</div>
          </div>
        </div>
        
        {showPriceChart && showChart && (
          <div className="mt-4">
            <FounderPriceChart founderId={founder.id} />
          </div>
        )}
        
        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={() => setShowChart(!showChart)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showChart ? 'Hide Chart' : 'Show Chart'}
          </button>
          
          {investorId && (
            <button
              onClick={() => setIsTradeModalOpen(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              disabled={!investorId}
            >
              Trade
            </button>
          )}
        </div>
      </div>
      
      {investorId && (
        <TradeModal
          isOpen={isTradeModalOpen}
          onClose={() => setIsTradeModalOpen(false)}
          founder={founder}
          investorId={investorId}
          investorBalance={investorBalance}
          onTradeComplete={() => {
            setIsTradeModalOpen(false);
            if (onTradeComplete) onTradeComplete();
          }}
        />
      )}
    </div>
  );
};
