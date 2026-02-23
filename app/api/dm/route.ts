import { NextRequest, NextResponse } from 'next/server'
import { getSession, SESSION_COOKIE } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'

const MAX_LENGTH = 200
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type RawMsg = {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
  sender_user: { nickname: string } | null
  receiver_user: { nickname: string } | null
}

function formatMsg(msg: RawMsg) {
  return {
    id: msg.id,
    sender_id: msg.sender_id,
    receiver_id: msg.receiver_id,
    sender_nickname: msg.sender_user?.nickname ?? '',
    receiver_nickname: msg.receiver_user?.nickname ?? '',
    content: msg.content,
    created_at: msg.created_at,
  }
}

const MSG_SELECT = `id, sender_id, receiver_id, content, created_at,
  sender_user:users!sender_id(nickname),
  receiver_user:users!receiver_id(nickname)`

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) return NextResponse.json({ success: false }, { status: 401 })

  const user = await getSession(sessionId)
  if (!user) return NextResponse.json({ success: false }, { status: 401 })

  const target = req.nextUrl.searchParams.get('with')
  if (!target || !UUID_REGEX.test(target)) {
    return NextResponse.json({ success: false, error: '유효하지 않은 대화 상대입니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('direct_messages')
    .select(MSG_SELECT)
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${target}),and(sender_id.eq.${target},receiver_id.eq.${user.id})`)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) return NextResponse.json({ success: false, error: '메시지를 불러오는데 실패했습니다.' }, { status: 500 })
  return NextResponse.json({ success: true, data: ((data as unknown as RawMsg[]) ?? []).map(formatMsg) })
}

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) return NextResponse.json({ success: false }, { status: 401 })

  const user = await getSession(sessionId)
  if (!user) return NextResponse.json({ success: false }, { status: 401 })

  const { to, content } = await req.json()

  if (!to || typeof to !== 'string' || !UUID_REGEX.test(to)) {
    return NextResponse.json({ success: false, error: '유효하지 않은 수신자입니다.' }, { status: 400 })
  }
  if (to === user.id) {
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
    .insert({ sender_id: user.id, receiver_id: to, content: content.trim() })
    .select(MSG_SELECT)
    .single()

  if (error) return NextResponse.json({ success: false, error: '전송에 실패했습니다.' }, { status: 500 })

  const result = formatMsg(data as unknown as RawMsg)

  await supabaseAdmin.channel(`dm:inbox:${to}`).send({
    type: 'broadcast',
    event: 'dm_message',
    payload: result,
  })

  return NextResponse.json({ success: true, data: result })
}
