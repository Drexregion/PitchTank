export interface Pitch {
  id: string;
  event_id: string;
  profile_user_id: string | null;
  application_id?: string | null;
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

export interface PitchWithPrice extends Pitch {
  current_price: number;
  market_cap: number;
}

export interface UserEmbed {
  id: string;
  auth_user_id?: string | null;
  first_name: string;
  last_name: string;
  profile_picture_url: string | null;
  profile_color: string | null;
  bio: string | null;
}

export interface PitchWithPriceAndUser extends PitchWithPrice {
  user: UserEmbed | null;
}

export type CreatePitchRequest = Omit<Pitch, 'id' | 'created_at' | 'updated_at'>;
export type UpdatePitchRequest = Partial<Omit<Pitch, 'id' | 'created_at' | 'updated_at' | 'event_id'>>;
