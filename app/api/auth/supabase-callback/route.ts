import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/session'
import { NICKNAME_REGEX } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'

function sanitizeNickname(raw?: string | null): string | null {
  if (!raw) return null
  const cleaned = raw.replace(/[^a-zA-Z0-9가-힣_]/g, '').slice(0, 20)
  return NICKNAME_REGEX.test(cleaned) ? cleaned : null
}

async function findUniqueNickname(base: string): Promise<string> {
  let nickname = base
  for (let i = 0; i < 5; i++) {
    const { data } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('nickname', nickname)
      .maybeSingle()
    if (!data) return nickname
    nickname = `${base.slice(0, 16)}${randomBytes(2).toString('hex')}`
  }
  return `user${randomBytes(4).toString('hex')}`
}

export async function POST(req: NextRequest) {
  try {
    const { access_token } = await req.json()
    if (!access_token) {
      return NextResponse.json({ success: false, error: '토큰이 없습니다.' }, { status: 400 })
    }

    // Supabase Auth 토큰 검증
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(access_token)
    if (authError || !user) {
      console.error('[supabase-callback] getUser failed:', authError?.message)
      return NextResponse.json({ success: false, error: '인증에 실패했습니다.' }, { status: 401 })
    }

    // 기존 유저 조회
    const { data: existing, error: selectError } = await supabaseAdmin
      .from('users')
      .select('id, nickname')
      .eq('supabase_auth_id', user.id)
      .maybeSingle()

    if (selectError) {
      console.error('[supabase-callback] select error:', selectError.message)
      return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 })
    }

    let authUser: AuthUser

    if (existing) {
      authUser = { id: existing.id, username: '', nickname: existing.nickname }
    } else {
      const rawName =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email?.split('@')[0]

      const baseNick = sanitizeNickname(rawName) ?? `user${randomBytes(3).toString('hex')}`
      const nickname = await findUniqueNickname(baseNick)

      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({ supabase_auth_id: user.id, nickname })
        .select('id, nickname')
        .single()

      if (insertError || !newUser) {
        console.error('[supabase-callback] insert error:', insertError?.message)
        return NextResponse.json({ success: false, error: '계정 생성에 실패했습니다.' }, { status: 500 })
      }
      authUser = { id: newUser.id, username: '', nickname: newUser.nickname }
    }

    const sessionId = await createSession(authUser)
    const res = NextResponse.json({ success: true })
    res.cookies.set(SESSION_COOKIE, sessionId, SESSION_COOKIE_OPTIONS)
    return res
  } catch (e) {
    console.error('[supabase-callback] unexpected error:', e)
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
