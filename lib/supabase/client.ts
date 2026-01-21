import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

if (supabaseUrl.includes('your-project.supabase.co')) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL содержит плейсхолдер. Замените на ваш Project URL из Supabase Dashboard (Settings → API).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
