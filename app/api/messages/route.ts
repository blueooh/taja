import { NextRequest, NextResponse } from 'next/server'
import { getSession, SESSION_COOKIE } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'

const MAX_LENGTH = 200

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const user = await getSession(sessionId)
  if (!user) {
    return NextResponse.json({ success: false, error: '세션이 만료되었습니다.' }, { status: 401 })
  }

  const { content } = await req.json()
  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ success: false, error: '내용을 입력해주세요.' }, { status: 400 })
  }
  if (content.trim().length > MAX_LENGTH) {
    return NextResponse.json({ success: false, error: `${MAX_LENGTH}자 이내로 입력해주세요.` }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({ nickname: user.nickname, content: content.trim() })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: '메시지 전송에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}
