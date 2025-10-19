import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { usePriceHistory } from '../hooks/usePriceHistory';

interface FounderPriceChartProps {
  founderId: string;
  height?: number | string;
  showGrid?: boolean;
  maxPoints?: number;
  since?: string; // ISO timestamp for filtering start time
}

export const FounderPriceChart: React.FC<FounderPriceChartProps> = ({
  founderId,
  height = 180,
  showGrid = true,
  maxPoints = 100,
  since
}) => {
  const { chartData, isLoading, error } = usePriceHistory({ 
    founderId,
    since,
    maxPoints
  });
  
  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-500">Loading chart data...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-sm text-red-500">Error loading chart: {error}</div>
      </div>
    );
  }
  
  if (!chartData.length) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-500">No price data available yet</div>
      </div>
    );
  }

  // Find min and max prices for better chart scaling
  const prices = chartData.map(point => point.price);
  const minPrice = Math.max(0, Math.min(...prices) * 0.9); // Add 10% padding, but not below 0
  const maxPrice = Math.max(...prices) * 1.1; // Add 10% padding
  
  // Calculate if the price is trending up or down
  const isUptrend = chartData.length >= 2 && 
    chartData[chartData.length - 1].price > chartData[0].price;
  
  const lineColor = isUptrend ? '#16a34a' : '#dc2626';

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis 
            dataKey="time" 
            minTickGap={30}
            tick={{ fontSize: 12 }} 
            tickFormatter={(time) => {
              // Only show hours and minutes, no seconds
              return time.substring(0, 5);
            }}
          />
          
          <YAxis 
            domain={[minPrice, maxPrice]}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `$${value.toFixed(2)}`}
            width={60}
          />
          
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          
          <Tooltip 
            formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
            labelFormatter={(label) => `Time: ${label}`}
          />
          
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: lineColor, strokeWidth: 1 }}
            isAnimationActive={true}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
