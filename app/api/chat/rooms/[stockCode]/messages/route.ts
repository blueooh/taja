import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSession, SESSION_COOKIE } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'

const MAX_LENGTH = 500
const PAGE_SIZE = 50

async function getUser() {
  const jar = await cookies()
  const sid = jar.get(SESSION_COOKIE)?.value
  if (!sid) return null
  return getSession(sid)
}

async function getRoomByStockCode(stockCode: string) {
  const { data } = await supabaseAdmin
    .from('chat_rooms')
    .select('id')
    .eq('stock_code', stockCode)
    .single()
  return data
}

type MsgRow = {
  id: string
  room_id: string
  user_id: string
  content: string
  created_at: string
  users: { nickname: string } | null
}

// 메시지 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ stockCode: string }> },
) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { stockCode } = await params
  const room = await getRoomByStockCode(stockCode)
  if (!room) {
    return NextResponse.json({ success: true, data: [] })
  }

  const cursor = req.nextUrl.searchParams.get('cursor')

  let query = supabaseAdmin
    .from('chat_messages')
    .select('id, room_id, user_id, content, created_at, users!user_id(nickname)')
    .eq('room_id', room.id)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ success: false, error: '메시지 조회에 실패했습니다.' }, { status: 500 })
  }

  const messages = ((data || []) as unknown as MsgRow[])
    .map((msg) => ({
      id: msg.id,
      roomId: msg.room_id,
      userId: msg.user_id,
      nickname: msg.users?.nickname ?? '',
      content: msg.content,
      createdAt: msg.created_at,
    }))
    .reverse()

  return NextResponse.json({ success: true, data: messages })
}

// 메시지 전송
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stockCode: string }> },
) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { stockCode } = await params
  const room = await getRoomByStockCode(stockCode)
  if (!room) {
    return NextResponse.json({ success: false, error: '채팅방을 찾을 수 없습니다.' }, { status: 404 })
  }

  const { content } = await req.json()
  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ success: false, error: '내용을 입력해주세요.' }, { status: 400 })
  }
  if (content.trim().length > MAX_LENGTH) {
    return NextResponse.json({ success: false, error: `${MAX_LENGTH}자 이내로 입력해주세요.` }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({ room_id: room.id, user_id: user.id, content: content.trim() })
    .select('id, room_id, user_id, content, created_at')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: '전송에 실패했습니다.' }, { status: 500 })
  }

  const message = {
    id: data.id,
    roomId: data.room_id,
    userId: data.user_id,
    nickname: user.nickname,
    content: data.content,
    createdAt: data.created_at,
  }

  // 실시간 브로드캐스트
  await supabaseAdmin.channel(`chat:${stockCode}`).send({
    type: 'broadcast',
    event: 'new_message',
    payload: message,
  })

  return NextResponse.json({ success: true, data: message })
}
