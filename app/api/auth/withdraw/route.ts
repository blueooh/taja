import { NextRequest, NextResponse } from 'next/server'
import { pbkdf2Sync } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { deleteSession, SESSION_COOKIE } from '@/lib/session'

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const verify = pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex')
  return verify === hash
}

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  try {
    const { password } = await req.json()
    if (!password) {
      return NextResponse.json({ success: false, error: '비밀번호를 입력해주세요.' }, { status: 400 })
    }

    // 세션에서 사용자 ID 확인
    const { getSession } = await import('@/lib/session')
    const sessionUser = await getSession(sessionId)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: '세션이 만료되었습니다.' }, { status: 401 })
    }

    // 비밀번호 검증
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, password_hash')
      .eq('id', sessionUser.id)
      .maybeSingle()

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ success: false, error: '비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    // 회원 삭제
    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', user.id)

    if (error) {
      return NextResponse.json({ success: false, error: '탈퇴 처리 중 오류가 발생했습니다.' }, { status: 500 })
    }

    // 세션 삭제 + 쿠키 제거
    await deleteSession(sessionId).catch(() => {})
    const res = NextResponse.json({ success: true })
    res.cookies.delete(SESSION_COOKIE)
    return res
  } catch {
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
