import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { FounderUser, UpdateFounderUserRequest } from '../types/FounderUser';
import { Founder } from '../types/Founder';

type UseFounderUserOptions = {
  founderUserId?: string;
};

type UseFounderUserReturn = {
  founderUser: FounderUser | null;
  founderProjects: Founder[];
  isLoading: boolean;
  error: string | null;
  updateProfile: (data: UpdateFounderUserRequest) => Promise<{ success: boolean; error?: string }>;
  refreshData: () => Promise<void>;
};

/**
 * Hook to manage founder user data and profile updates
 */
export function useFounderUser({ founderUserId }: UseFounderUserOptions = {}): UseFounderUserReturn {
  const [founderUser, setFounderUser] = useState<FounderUser | null>(null);
  const [founderProjects, setFounderProjects] = useState<Founder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches founder user data and their projects
   */
  const fetchFounderData = async () => {
    if (!founderUserId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch founder user data
      const { data: userData, error: userError } = await supabase
        .from('founder_users')
        .select('*')
        .eq('id', founderUserId)
        .maybeSingle();

      if (userError) {
        throw userError;
      }

      setFounderUser(userData);

      // Fetch founder's projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('founders')
        .select('*')
        .eq('founder_user_id', founderUserId)
        .order('created_at', { ascending: false });

      if (projectsError) {
        throw projectsError;
      }

      setFounderProjects(projectsData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch founder data');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Updates founder user profile
   */
  const updateProfile = async (data: UpdateFounderUserRequest): Promise<{ success: boolean; error?: string }> => {
    if (!founderUserId) {
      return { success: false, error: 'No founder user ID provided' };
    }

    try {
      setIsLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('founder_users')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', founderUserId);

      if (updateError) {
        throw updateError;
      }

      // Refresh data after successful update
      await fetchFounderData();
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update profile';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refreshes founder data
   */
  const refreshData = async (): Promise<void> => {
    await fetchFounderData();
  };

  // Fetch data when founderUserId changes
  useEffect(() => {
    fetchFounderData();
  }, [founderUserId]);

  // Set up realtime subscription for founder user updates
  useEffect(() => {
    if (!founderUserId) return;

    const channel = supabase
      .channel(`founder_user_${founderUserId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'founder_users',
        filter: `id=eq.${founderUserId}`
      }, (payload) => {
        setFounderUser(payload.new as FounderUser);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'founders',
        filter: `founder_user_id=eq.${founderUserId}`
      }, () => {
        // Refresh projects when they change
        fetchFounderData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [founderUserId]);

  return {
    founderUser,
    founderProjects,
    isLoading,
    error,
    updateProfile,
    refreshData
  };
}
