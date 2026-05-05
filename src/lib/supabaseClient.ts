import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PRIMARY_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PRIMARY_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const BACKUP_URL  = import.meta.env.VITE_SUPABASE_BACKUP_URL as string;
const BACKUP_KEY  = import.meta.env.VITE_SUPABASE_BACKUP_ANON_KEY as string;
const APP_VERSION = import.meta.env.VITE_APP_VERSION;

if (!PRIMARY_URL || !PRIMARY_KEY) {
  console.error('Missing Supabase environment variables. Check your .env file.');
}

const LS_USING_BACKUP = 'pt_using_backup';
const LS_LAST_VERSION = 'pt_app_version';

// On a new deploy, clear the backup flag so primary is retried fresh.
if (APP_VERSION) {
  const lastSeen = localStorage.getItem(LS_LAST_VERSION);
  if (lastSeen !== APP_VERSION) {
    localStorage.removeItem(LS_USING_BACKUP);
    localStorage.setItem(LS_LAST_VERSION, APP_VERSION);
  }
}

// Synchronous client initialization based on current localStorage state.
// This keeps all existing imports working without any await.
const _usingBackup = localStorage.getItem(LS_USING_BACKUP) === 'true';
const _activeUrl   = _usingBackup && BACKUP_URL  ? BACKUP_URL  : PRIMARY_URL;
const _activeKey   = _usingBackup && BACKUP_KEY  ? BACKUP_KEY  : PRIMARY_KEY;

export const supabaseUrl    = _activeUrl;
export const supabaseAnonKey = _activeKey;
export const supabase: SupabaseClient = createClient(_activeUrl, _activeKey);

// Async resolution: checks primary health, then checks backup's failover_enabled flag.
// Runs at most once per page load (memoized). Safe to call from anywhere.
// Most components just use the synchronous `supabase` export above.
let _resolvedClient: SupabaseClient | null = null;
let _resolvePromise: Promise<SupabaseClient> | null = null;

export function resolveSupabaseClient(): Promise<SupabaseClient> {
  if (_resolvedClient) return Promise.resolve(_resolvedClient);
  if (_resolvePromise) return _resolvePromise;

  _resolvePromise = (async (): Promise<SupabaseClient> => {
    // Already on backup — nothing to do
    if (_usingBackup) {
      _resolvedClient = supabase;
      return supabase;
    }

    // Check primary health
    let primaryHealthy = true;
    try {
      const res = await fetch(`${PRIMARY_URL}/auth/v1/health`, {
        signal: AbortSignal.timeout(4000),
      });
      primaryHealthy = res.ok;
    } catch {
      primaryHealthy = false;
    }

    if (primaryHealthy) {
      _resolvedClient = supabase;
      return supabase;
    }

    // Primary is down — check if admin has authorized failover on backup
    if (!BACKUP_URL || !BACKUP_KEY) {
      _resolvedClient = supabase;
      return supabase;
    }

    try {
      const cfgRes = await fetch(
        `${BACKUP_URL}/rest/v1/app_config?key=eq.failover_enabled&select=value`,
        {
          headers: { apikey: BACKUP_KEY, Authorization: `Bearer ${BACKUP_KEY}` },
          signal: AbortSignal.timeout(4000),
        }
      );
      if (cfgRes.ok) {
        const rows: Array<{ value: boolean }> = await cfgRes.json();
        if (rows[0]?.value === true) {
          localStorage.setItem(LS_USING_BACKUP, 'true');
          const backupClient = createClient(BACKUP_URL, BACKUP_KEY);
          _resolvedClient = backupClient;
          return backupClient;
        }
      }
    } catch {
      // Backup also unreachable — stay on primary
    }

    _resolvedClient = supabase;
    return supabase;
  })();

  return _resolvePromise;
}

export type SupabaseQueryOptions = {
  limit?: number;
  offset?: number;
  order?: {
    column: string;
    ascending: boolean;
  };
}

export const handleSupabaseError = (error: any) => {
  console.error('Supabase Error:', error);
  return {
    error: error.message || 'An unexpected error occurred',
    code: error.code
  };
};
