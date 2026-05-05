export interface User {
  id: string;
  auth_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_picture_url: string | null;
  profile_color: string | null;
  bio: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  role: "pitcher" | "sponsor" | "judge" | "investor" | "member" | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserWithStats extends User {
  projects_count: number;
  total_market_cap: number;
  active_projects: number;
}
