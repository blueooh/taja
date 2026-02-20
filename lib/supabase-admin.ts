import { createClient } from '@supabase/supabase-js'

// service_role 키는 RLS를 우회하므로 서버 API 라우트에서만 사용
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
