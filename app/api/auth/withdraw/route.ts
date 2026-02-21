import { NextRequest, NextResponse } from 'next/server'
import { pbkdf2Sync } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession, deleteSession, SESSION_COOKIE } from '@/lib/session'

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
    const body = await req.json()
    const { password } = body

    const sessionUser = await getSession(sessionId)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: '세션이 만료되었습니다.' }, { status: 401 })
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, password_hash, supabase_auth_id')
      .eq('id', sessionUser.id)
      .maybeSingle()

    if (!user) {
      return NextResponse.json({ success: false, error: '계정을 찾을 수 없습니다.' }, { status: 404 })
    }

    const isSocialAccount = !user.password_hash

    if (isSocialAccount) {
      // 소셜 계정: 비밀번호 검증 없이 탈퇴
      // (클라이언트에서 확인 절차를 거침)
    } else {
      // 일반 계정: 비밀번호 확인 필수
      if (!password) {
        return NextResponse.json({ success: false, error: '비밀번호를 입력해주세요.' }, { status: 400 })
      }
      if (!verifyPassword(password, user.password_hash)) {
        return NextResponse.json({ success: false, error: '비밀번호가 올바르지 않습니다.' }, { status: 401 })
      }
    }

    // users 테이블에서 삭제
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', user.id)

    if (deleteError) {
      return NextResponse.json({ success: false, error: '탈퇴 처리 중 오류가 발생했습니다.' }, { status: 500 })
    }

    // 소셜 계정이면 Supabase Auth에서도 삭제
    if (user.supabase_auth_id) {
      await supabaseAdmin.auth.admin.deleteUser(user.supabase_auth_id).catch(() => {})
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
