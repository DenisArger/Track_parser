import { createClient } from '@supabase/supabase-js'

export function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  if (supabaseUrl.includes('your-project.supabase.co')) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL содержит плейсхолдер. Замените на ваш Project URL из Supabase Dashboard (Settings → API).'
    )
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
