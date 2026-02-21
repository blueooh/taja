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
  const { access_token } = await req.json()
  if (!access_token) {
    return NextResponse.json({ success: false, error: '토큰이 없습니다.' }, { status: 400 })
  }

  // Supabase Auth 토큰으로 유저 정보 가져오기
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token)
  if (error || !user) {
    return NextResponse.json({ success: false, error: '인증에 실패했습니다.' }, { status: 401 })
  }

  // 기존 유저 조회 (supabase_auth_id로)
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id, nickname')
    .eq('supabase_auth_id', user.id)
    .maybeSingle()

  let authUser: AuthUser

  if (existing) {
    authUser = { id: existing.id, username: '', nickname: existing.nickname }
  } else {
    // 닉네임 생성: 제공자 이름 → 이메일 앞부분 → 랜덤
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
      return NextResponse.json({ success: false, error: '계정 생성에 실패했습니다.' }, { status: 500 })
    }
    authUser = { id: newUser.id, username: '', nickname: newUser.nickname }
  }

  const sessionId = await createSession(authUser)
  const res = NextResponse.json({ success: true })
  res.cookies.set(SESSION_COOKIE, sessionId, SESSION_COOKIE_OPTIONS)
  return res
}
