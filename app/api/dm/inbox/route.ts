import { NextRequest, NextResponse } from 'next/server'
import { getSession, SESSION_COOKIE } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'

export interface ConversationItem {
  partnerId: string
  partnerNickname: string
  lastMessage: string
  lastAt: string
}

type MsgRow = {
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
  sender: { nickname: string } | null
  receiver: { nickname: string } | null
}

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) return NextResponse.json({ success: false }, { status: 401 })

  const user = await getSession(sessionId)
  if (!user) return NextResponse.json({ success: false }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('direct_messages')
    .select(`sender_id, receiver_id, content, created_at,
      sender:users!sender_id(nickname),
      receiver:users!receiver_id(nickname)`)
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ success: false }, { status: 500 })

  const convMap = new Map<string, ConversationItem>()
  for (const msg of (data as unknown as MsgRow[]) ?? []) {
    const isMe = msg.sender_id === user.id
    const partnerId = isMe ? msg.receiver_id : msg.sender_id
    const partnerNickname = isMe
      ? (msg.receiver?.nickname ?? '')
      : (msg.sender?.nickname ?? '')
    if (!convMap.has(partnerId)) {
      convMap.set(partnerId, { partnerId, partnerNickname, lastMessage: msg.content, lastAt: msg.created_at })
    }
  }

  return NextResponse.json({ success: true, data: Array.from(convMap.values()) })
}
