import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: false, // OAuth 콜백은 /auth/callback에서 직접 처리
  },
})

export interface Message {
  id: string
  nickname: string
  content: string
  created_at: string
}
