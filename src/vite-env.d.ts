/// <reference types="vite/client" />

interface ImportMeta {
  readonly env: {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
    readonly VITE_SUPABASE_SERVICE_ROLE_KEY?: string
    readonly VITE_SUPABASE_BACKUP_URL: string
    readonly VITE_SUPABASE_BACKUP_ANON_KEY: string
    readonly VITE_APP_VERSION?: string
    readonly [key: string]: string | undefined
  }
}
