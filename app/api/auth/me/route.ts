import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession, SESSION_COOKIE } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { NICKNAME_REGEX } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) {
    return NextResponse.json({ success: false }, { status: 401 })
  }
  const user = await getSession(sessionId)
  if (!user) {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  const { data: dbUser } = await supabaseAdmin
    .from('users')
    .select('supabase_auth_id')
    .eq('id', user.id)
    .maybeSingle()

  const isSocial = !!dbUser?.supabase_auth_id

  let username = user.username
  if (isSocial && !username && dbUser?.supabase_auth_id) {
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(dbUser.supabase_auth_id)
    username = authData?.user?.email ?? ''
  }

  return NextResponse.json({
    success: true,
    data: { ...user, username, isSocial },
  })
}

export async function PATCH(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })

  const user = await getSession(sessionId)
  if (!user) return NextResponse.json({ success: false, error: '세션이 만료되었습니다.' }, { status: 401 })

  const { nickname } = await req.json()

  if (!nickname || !NICKNAME_REGEX.test(nickname)) {
    return NextResponse.json({ success: false, error: '1~20자의 한글/영문/숫자/_만 사용 가능합니다.' })
  }
  if (nickname === user.nickname) {
    return NextResponse.json({ success: false, error: '현재 닉네임과 동일합니다.' })
  }

  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('nickname', nickname)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ success: false, error: '이미 사용중인 닉네임입니다.' })
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ nickname })
    .eq('id', user.id)
  if (error) {
    return NextResponse.json({ success: false, error: '닉네임 변경에 실패했습니다.' })
  }

  const updatedUser = { ...user, nickname }
  await updateSession(sessionId, updatedUser)

  return NextResponse.json({ success: true, data: updatedUser })
}
