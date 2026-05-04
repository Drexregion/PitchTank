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
  claimed_by_user_id: string | null;
}
