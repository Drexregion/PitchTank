export interface PriceHistoryPoint {
  id: string;
  event_id: string;
  founder_id: string;
  price: number;
  shares_in_pool: number;
  cash_in_pool: number;
  source: 'trade' | 'interval';
  recorded_at: string;
}

export interface ChartPoint {
  time: string; // Formatted time for display
  price: number;
}

export interface OHLCPoint {
  minute_bucket: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
}
