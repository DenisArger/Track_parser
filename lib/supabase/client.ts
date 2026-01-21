import { createBrowserClient } from '@supabase/ssr'

let _client: ReturnType<typeof createBrowserClient> | null = null

function getSupabase() {
  if (_client) return _client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  }
  if (supabaseUrl.includes('your-project.supabase.co')) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL содержит плейсхолдер. Замените на ваш Project URL из Supabase Dashboard (Settings → API).'
    )
  }
  _client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  return _client
}

export { getSupabase }

/**
 * Ленивая обёртка: проверка env и создание клиента при первом обращении,
 * а не при загрузке модуля — чтобы не ломать Server Components / сборку.
 * @deprecated Для нового кода предпочтительно getSupabase().
 */
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_, prop) {
    const c = getSupabase() as any
    const v = c[prop]
    return typeof v === 'function' ? v.bind(c) : v
  },
})
