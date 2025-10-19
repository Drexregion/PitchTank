export interface Event {
  id: string;
  name: string;
  description: string | null;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
}

export interface EventSettings {
  event_id: string;
  snapshot_interval_seconds: number;
  max_price_history_points: number;
  created_at: string;
  updated_at: string;
}

export interface EventWithStats extends Event {
  founder_count: number;
  investor_count: number;
  trade_count: number;
  total_volume: number; // Sum of all trade amounts
}
