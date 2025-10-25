export interface FounderUser {
  id: string;
  auth_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_picture_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface FounderUserWithStats extends FounderUser {
  projects_count: number;
  total_market_cap: number;
  active_projects: number;
}

export interface CreateFounderUserRequest {
  auth_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface UpdateFounderUserRequest {
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string | null;
  bio?: string | null;
}
