import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSession, SESSION_COOKIE } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function getUser() {
  const jar = await cookies()
  const sid = jar.get(SESSION_COOKIE)?.value
  if (!sid) return null
  return getSession(sid)
}

// 채팅방 나가기
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ stockCode: string }> },
) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { stockCode } = await params

  // 방 찾기
  const { data: room } = await supabaseAdmin
    .from('chat_rooms')
    .select('id')
    .eq('stock_code', stockCode)
    .single()

  if (!room) {
    return NextResponse.json({ success: true })
  }

  // 멤버 삭제
  await supabaseAdmin
    .from('chat_room_members')
    .delete()
    .eq('room_id', room.id)
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
