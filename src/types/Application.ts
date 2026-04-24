export interface EventQuestion {
  id: string;
  event_id: string;
  question_text: string;
  description: string | null;
  question_type: 'text' | 'textarea' | 'image' | 'url' | 'website_url';
  required: boolean;
  sort_order: number;
  created_at: string;
}

export interface Application {
  id: string;
  event_id: string;
  applicant_email: string;
  status: 'pending' | 'approved' | 'rejected';
  answers: Record<string, string>;
  submitted_at: string;
  reviewed_at: string | null;
  created_at: string;
  claim_token: string | null;
  claimed_by_auth_user_id: string | null;
}
