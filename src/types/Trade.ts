export interface Trade {
  id: string;
  event_id: string;
  investor_id: string;
  founder_id: string;
  shares: number;
  amount: number; // Positive for buy (cost), negative for sell (payout)
  type: 'buy' | 'sell';
  price_per_share: number;
  created_at: string;
}

export interface TradeWithDetails extends Trade {
  investor_name: string;
  founder_name: string;
}
