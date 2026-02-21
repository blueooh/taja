import { NextRequest, NextResponse } from 'next/server'
import { getSession, SESSION_COOKIE } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'

const MAX_LENGTH = 200

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) return NextResponse.json({ success: false }, { status: 401 })

  const user = await getSession(sessionId)
  if (!user) return NextResponse.json({ success: false }, { status: 401 })

  const target = req.nextUrl.searchParams.get('with')
  if (!target) return NextResponse.json({ success: false, error: '대화 상대가 필요합니다.' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('direct_messages')
    .select('*')
    .or(`and(sender.eq.${user.nickname},receiver.eq.${target}),and(sender.eq.${target},receiver.eq.${user.nickname})`)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) return NextResponse.json({ success: false, error: '메시지를 불러오는데 실패했습니다.' }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) return NextResponse.json({ success: false }, { status: 401 })

  const user = await getSession(sessionId)
  if (!user) return NextResponse.json({ success: false }, { status: 401 })

  const { to, content } = await req.json()

  if (!to || typeof to !== 'string') {
    return NextResponse.json({ success: false, error: '수신자가 필요합니다.' }, { status: 400 })
  }
  if (to === user.nickname) {
    return NextResponse.json({ success: false, error: '자신에게는 DM을 보낼 수 없습니다.' }, { status: 400 })
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ success: false, error: '내용을 입력해주세요.' }, { status: 400 })
  }
  if (content.trim().length > MAX_LENGTH) {
    return NextResponse.json({ success: false, error: `${MAX_LENGTH}자 이내로 입력해주세요.` }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('direct_messages')
    .insert({ sender: user.nickname, receiver: to, content: content.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ success: false, error: '전송에 실패했습니다.' }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
