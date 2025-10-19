import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Typed helper functions for database access
export type SupabaseQueryOptions = {
  limit?: number;
  offset?: number;
  order?: {
    column: string;
    ascending: boolean;
  };
}

// Common error handling utility
export const handleSupabaseError = (error: any) => {
  console.error('Supabase Error:', error);
  return {
    error: error.message || 'An unexpected error occurred',
    code: error.code
  };
};
