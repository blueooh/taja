import { NextRequest, NextResponse } from 'next/server'
import { pbkdf2Sync } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/session'

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const verify = pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex')
  return verify === hash
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: '아이디와 비밀번호를 입력해주세요.' },
        { status: 400 }
      )
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, username, nickname, password_hash')
      .eq('username', username)
      .maybeSingle()

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json(
        { success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    const sessionId = await createSession({
      id: user.id,
      username: user.username,
      nickname: user.nickname,
    })

    const res = NextResponse.json({ success: true })
    res.cookies.set(SESSION_COOKIE, sessionId, SESSION_COOKIE_OPTIONS)
    return res
  } catch {
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
