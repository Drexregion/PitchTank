export interface ScheduleItem {
  title: string;
  description?: string;
  time?: string;
  duration?: string;
}

export interface Event {
  id: string;
  name: string;
  description: string | null;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  closing_at?: string | null;
  schedule?: ScheduleItem[];
}

export interface EventSettings {
  event_id: string;
  snapshot_interval_seconds: number;
  max_price_history_points: number;
  hide_leaderboard_and_prices: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventWithStats extends Event {
  founder_count: number;
  investor_count: number;
  trade_count: number;
  total_volume: number; // Sum of all trade amounts
}
