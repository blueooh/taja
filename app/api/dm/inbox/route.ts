import { NextRequest, NextResponse } from 'next/server'
import { getSession, SESSION_COOKIE } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'

export interface ConversationItem {
  partner: string
  lastMessage: string
  lastAt: string
}

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) return NextResponse.json({ success: false }, { status: 401 })

  const user = await getSession(sessionId)
  if (!user) return NextResponse.json({ success: false }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('direct_messages')
    .select('sender, receiver, content, created_at')
    .or(`sender.eq.${user.nickname},receiver.eq.${user.nickname}`)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ success: false }, { status: 500 })

  const convMap = new Map<string, ConversationItem>()
  for (const msg of data ?? []) {
    const partner = msg.sender === user.nickname ? msg.receiver : msg.sender
    if (!convMap.has(partner)) {
      convMap.set(partner, { partner, lastMessage: msg.content, lastAt: msg.created_at })
    }
  }

  return NextResponse.json({ success: true, data: Array.from(convMap.values()) })
}
