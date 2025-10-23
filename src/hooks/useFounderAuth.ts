import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { FounderInvitation } from '../types/FounderInvitation';
import { CreateFounderUserRequest } from '../types/FounderUser';

type FounderAuthHookReturn = {
  invitation: FounderInvitation | null;
  isValidInvitation: boolean;
  isLoading: boolean;
  error: string | null;
  validateInvitation: (token: string) => Promise<boolean>;
  createFounderAccount: (data: CreateFounderUserRequest) => Promise<{ success: boolean; error?: string }>;
  markInvitationUsed: (token: string) => Promise<void>;
};

/**
 * Hook to handle founder invitation validation and account creation
 */
export function useFounderAuth(): FounderAuthHookReturn {
  const [invitation, setInvitation] = useState<FounderInvitation | null>(null);
  const [isValidInvitation, setIsValidInvitation] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validates an invitation token and checks if it's still valid
   */
  const validateInvitation = useCallback(async (token: string): Promise<boolean> => {
    try {
      console.log('Validating invitation token:', token);
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('founder_invitations')
        .select('*')
        .eq('invitation_token', token)
        .eq('status', 'sent')
        .maybeSingle();

      console.log('Invitation validation result:', { data, error: fetchError });

      if (fetchError) {
        console.error('Invitation validation error:', fetchError);
        if (fetchError.code === 'PGRST116') {
          setError('Invalid or expired invitation link');
          setIsValidInvitation(false);
          return false;
        }
        throw fetchError;
      }

      if (!data) {
        setError('Invalid or expired invitation link');
        setIsValidInvitation(false);
        return false;
      }

      // Check if invitation has expired
      const now = new Date();
      const expiresAt = new Date(data.expires_at);
      
      if (now > expiresAt) {
        setError('Invitation link has expired');
        setIsValidInvitation(false);
        return false;
      }

      console.log('Invitation validated successfully:', data);
      setInvitation(data);
      setIsValidInvitation(true);
      return true;
    } catch (err: any) {
      console.error('Invitation validation exception:', err);
      setError(err.message || 'Failed to validate invitation');
      setIsValidInvitation(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Creates a founder user account after successful invitation validation
   */
  const createFounderAccount = useCallback(async (data: CreateFounderUserRequest): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('Creating founder account with data:', data);
      setIsLoading(true);
      setError(null);

      // Verify the email matches the invitation
      if (!invitation || invitation.email !== data.email) {
        console.error('Email does not match invitation:', { invitationEmail: invitation?.email, providedEmail: data.email });
        return { success: false, error: 'Email does not match invitation' };
      }

      console.log('Creating founder user record...');
      // Create founder user record
      const { data: insertData, error: createError } = await supabase
        .from('founder_users')
        .insert({
          auth_user_id: data.auth_user_id,
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name
        })
        .select();

      console.log('Founder user creation result:', { data: insertData, error: createError });

      if (createError) {
        console.error('Founder user creation error:', createError);
        throw createError;
      }

      console.log('Founder account created successfully');
      return { success: true };
    } catch (err: any) {
      console.error('Founder account creation exception:', err);
      const errorMessage = err.message || 'Failed to create founder account';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [invitation]);

  /**
   * Marks an invitation as used after successful account creation
   */
  const markInvitationUsed = useCallback(async (token: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('founder_invitations')
        .update({ 
          status: 'used',
          used_at: new Date().toISOString()
        })
        .eq('invitation_token', token);

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error('Failed to mark invitation as used:', err);
      // Don't throw here as the account was already created successfully
    }
  }, []);

  return {
    invitation,
    isValidInvitation,
    isLoading,
    error,
    validateInvitation,
    createFounderAccount,
    markInvitationUsed
  };
}
