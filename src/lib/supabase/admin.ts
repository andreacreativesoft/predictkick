import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Service role client — bypasses RLS
// ONLY use in server-side code: cron jobs, webhooks, admin operations
// NEVER import this in client components
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
