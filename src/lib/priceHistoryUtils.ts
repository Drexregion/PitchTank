import { ChartPoint, PriceHistoryPoint } from '../types/PriceHistory';

/**
 * Formats price history data into chart-friendly format
 * @param points Raw price history points from database
 * @param maxPoints Maximum number of points to include (newest first)
 * @returns Array of simplified chart points
 */
export function formatPriceHistoryForChart(
  points: PriceHistoryPoint[],
  maxPoints: number = 1000
): ChartPoint[] {
  // Sort by timestamp ascending (oldest first)
  const sortedPoints = [...points].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );
  
  // Take only the latest points if we have too many
  const limitedPoints = sortedPoints.slice(-maxPoints);
  
  // Transform to chart-friendly format
  return limitedPoints.map(p => ({
    time: formatTimeForChart(p.recorded_at),
    price: Number(p.price)
  }));
}

/**
 * Formats a timestamp for display on charts
 * @param timestamp ISO timestamp string
 * @returns Formatted time string (HH:MM:SS)
 */
export function formatTimeForChart(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Downsamples price history to reduce number of points for performance
 * @param points Original price history points
 * @param targetCount Target number of points
 * @returns Downsampled array of price history points
 */
export function downsamplePriceHistory(
  points: PriceHistoryPoint[],
  targetCount: number = 100
): PriceHistoryPoint[] {
  if (points.length <= targetCount) {
    return points;
  }

  // Use LTTB (Largest-Triangle-Three-Buckets) algorithm for best visual representation
  // This is a simplified version that preserves important price movements
  const result: PriceHistoryPoint[] = [];
  const bucketSize = points.length / targetCount;
  
  // Always include first point
  result.push(points[0]);
  
  // Process buckets
  for (let i = 1; i < targetCount - 1; i++) {
    const bucketStart = Math.floor(i * bucketSize);
    const bucketEnd = Math.floor((i + 1) * bucketSize);
    
    // Find point with maximum price difference in this bucket
    let maxDiff = 0;
    let maxDiffIndex = bucketStart;
    
    for (let j = bucketStart; j < bucketEnd; j++) {
      const prevPrice = Number(result[result.length - 1].price);
      const currPrice = Number(points[j].price);
      const diff = Math.abs(currPrice - prevPrice);
      
      if (diff > maxDiff) {
        maxDiff = diff;
        maxDiffIndex = j;
      }
    }
    
    // Add the point with highest difference
    result.push(points[maxDiffIndex]);
  }
  
  // Always include last point
  result.push(points[points.length - 1]);
  
  return result;
}
