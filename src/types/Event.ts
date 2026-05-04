export interface ScheduleItem {
  title: string;
  description?: string;
  time?: string;
  duration?: string;
}

export interface Judge {
  name: string;
  profile_picture?: string;
  bio?: string;
  linkedin?: string;
}

export interface Sponsor {
  name: string;
  logo?: string;
  description?: string;
  website?: string;
}

export interface EventQuestion {
  id: string;
  question_text: string;
  description: string | null;
  question_type: 'text' | 'textarea' | 'image' | 'url' | 'website_url';
  required: boolean;
  sort_order: number;
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
  judges?: Judge[];
  sponsors?: Sponsor[];
  snapshot_interval_seconds: number;
  max_price_history_points: number;
  hide_leaderboard_and_prices: boolean;
  registration_questions: EventQuestion[];
}

export interface EventWithStats extends Event {
  founder_count: number;
  investor_count: number;
  trade_count: number;
  total_volume: number;
}
