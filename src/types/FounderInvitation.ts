export interface FounderInvitation {
  id: string;
  email: string;
  invitation_token: string;
  event_id: string;
  invited_by: string;
  status: 'pending' | 'sent' | 'used' | 'expired';
  expires_at: string;
  created_at: string;
  used_at?: string;
}

export interface FounderInvitationWithDetails extends FounderInvitation {
  event_name: string;
  invited_by_name: string;
}

export interface CreateFounderInvitationRequest {
  email: string;
  event_id: string;
}

export interface BulkInviteRequest {
  emails: string[];
  event_id: string;
}
