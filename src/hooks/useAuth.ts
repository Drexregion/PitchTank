import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session, User } from '@supabase/supabase-js';

type UserWithRoles = {
  id: string;
  email?: string;
  roles: {
    role: string;
    event_id: string;
  }[];
}

type AuthHookReturn = {
  session: Session | null;
  user: UserWithRoles | null;
  isLoading: boolean;
  isAdmin: boolean;
  isInvestor: boolean;
  isFounder: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{user: User | null, error: Error | null}>;
  signOut: () => Promise<void>;
};

/**
 * Hook to manage authentication and user roles
 */
export function useAuth(): AuthHookReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserWithRoles | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    setIsLoading(true);
    
    const fetchSession = async () => {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        setError(sessionError.message);
        setIsLoading(false);
        return;
      }
      
      setSession(currentSession);
      
      if (currentSession?.user) {
        // await fetchUserRoles(currentSession.user);
        setUser({
        id: currentSession.user.id,
        email: currentSession.user.email,
        // Set empty roles or basic information that doesn't require DB queries
        roles: [] // Can be populated on-demand when needed
      });
      } else {
        setUser(null);
      }
      
      setIsLoading(false);
    };
    
    fetchSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
    setSession(newSession);
    
    if (newSession?.user) {
      // Simply set the user without making additional queries
      setUser({
        id: newSession.user.id,
        email: newSession.user.email,
        // Set empty roles or basic information that doesn't require DB queries
        roles: [] // Can be populated on-demand when needed
      });
      
      // Optionally log or dispatch events about auth state changes
      console.log(`User authenticated: ${newSession.user.id}`);
    } else {
      setUser(null);
      // Clean up any user-specific state
      console.log("User logged out");
    }
});

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Helper to fetch user roles
  // const fetchUserRoles = async (authUser: User) => {
  //   try {
  //     const { data: roles, error: rolesError } = await supabase
  //       .from('user_roles')
  //       .select('role, event_id')
  //       .eq('user_id', authUser.id);
        
  //     if (rolesError) {
  //       throw rolesError;
  //     }
      
  //     setUser({
  //       id: authUser.id,
  //       email: authUser.email,
  //       roles: roles || []
  //     });
  //   } catch (err: any) {
  //     setError(err.message || 'Failed to fetch user roles');
  //   }
  // };

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);
      
      const { data: { session: newSession }, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (signInError) {
        throw signInError;
      }
      
      setSession(newSession);
      
      if (newSession?.user) {
        setUser({
          id: newSession.user.id,
          email: newSession.user.email,
          roles: []
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string, name: string) => {
    try {
      console.log("started sign up function");
      setError(null);
      setIsLoading(true);
      console.log("email: ", email);
      
      const { data: { session: newSession, user: newUser }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name
          }
        }
      });
      console.log("user created: ", newUser);
      
      if (signUpError) {
        throw signUpError;
      }
      
      setSession(newSession);
      console.log("session created: ", newSession);
      if (newUser) {
        setUser({
          id: newUser.id,
          email: newUser.email,
          roles: []
        });
      }
      console.log("user created: ", newUser);
      console.log("session created: ", newSession);
      
      return { user: newUser, error: null };
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
      return { user: null, error: err };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setError(null);
      await supabase.auth.signOut();
    } catch (err: any) {
      setError(err.message || 'Failed to sign out');
    }
  };

  // Check user roles
  // const isAdmin = user?.roles.some(r => r.role === 'admin') || false;
  const isAdmin = false;
  // const isInvestor = user?.roles.some(r => r.role === 'investor') || false;
  const isInvestor = true;
  // const isFounder = user?.roles.some(r => r.role === 'founder') || false;
  const isFounder = false;

  return {
    session,
    user,
    isLoading,
    isAdmin,
    isInvestor,
    isFounder,
    error,
    signIn,
    signUp,
    signOut
  };
}
