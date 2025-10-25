export interface Founder {
  id: string;
  event_id: string;
  founder_user_id: string;
  name: string;
  bio: string | null;
  logo_url: string | null;
  pitch_summary: string | null;
  pitch_url: string | null;
  shares_in_pool: number;
  cash_in_pool: number;
  k_constant: number;
  min_reserve_shares: number;
  created_at: string;
  updated_at: string;
}

export interface FounderWithPrice extends Founder {
  current_price: number; // Calculated as cash_in_pool / shares_in_pool
  market_cap: number;    // Calculated as current_price * (initial shares - shares_in_pool)
}

export interface FounderWithUserDetails extends Founder {
  founder_user: {
    first_name: string;
    last_name: string;
    profile_picture_url: string | null;
    bio: string | null;
  };
}

export interface CreateFounderProjectRequest {
  event_id: string;
  founder_user_id: string;
  name: string;
  bio?: string;
  logo_url?: string;
  pitch_summary?: string;
  pitch_url?: string;
  shares_in_pool?: number;
  cash_in_pool?: number;
  k_constant?: number;
  min_reserve_shares?: number;
}

export interface UpdateFounderProjectRequest {
  name?: string | null;
  bio?: string | null;
  logo_url?: string | null;
  pitch_summary?: string | null;
  pitch_url?: string | null;
}
