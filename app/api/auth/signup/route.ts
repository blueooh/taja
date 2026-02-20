import { NextRequest, NextResponse } from 'next/server'
import { pbkdf2Sync, randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/session'
import { USERNAME_REGEX, NICKNAME_REGEX, PASSWORD_MIN, PASSWORD_MAX } from '@/lib/auth'

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex')
  return `${salt}:${hash}`
}

export async function POST(req: NextRequest) {
  try {
    const { username, password, nickname } = await req.json()

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json(
        { success: false, error: '아이디는 영문, 숫자, 밑줄(_) 3-20자여야 합니다.' },
        { status: 400 }
      )
    }
    if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      return NextResponse.json(
        { success: false, error: `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.` },
        { status: 400 }
      )
    }
    if (!NICKNAME_REGEX.test(nickname)) {
      return NextResponse.json(
        { success: false, error: '닉네임은 한글, 영문, 숫자, 밑줄(_) 1-20자여야 합니다.' },
        { status: 400 }
      )
    }

    // 아이디 중복 확인
    const { data: existingUsername } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (existingUsername) {
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 아이디입니다.' },
        { status: 409 }
      )
    }

    // 닉네임 중복 확인
    const { data: existingNickname } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('nickname', nickname)
      .maybeSingle()
    if (existingNickname) {
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 닉네임입니다.' },
        { status: 409 }
      )
    }

    // 유저 생성
    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert({ username, nickname, password_hash: hashPassword(password) })
      .select('id, username, nickname')
      .single()

    if (error || !newUser) {
      return NextResponse.json(
        { success: false, error: '회원가입에 실패했습니다.' },
        { status: 500 }
      )
    }

    const sessionId = await createSession({
      id: newUser.id,
      username: newUser.username,
      nickname: newUser.nickname,
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
