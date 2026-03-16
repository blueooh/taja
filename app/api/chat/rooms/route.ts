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

// 참여 중인 채팅방 목록
export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('chat_room_members')
    .select(`
      room_id,
      joined_at,
      chat_rooms!inner (
        id,
        stock_code,
        stock_name,
        created_at
      )
    `)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  if (error) {
    return NextResponse.json({ success: false, error: '목록 조회에 실패했습니다.' }, { status: 500 })
  }

  type RoomRow = {
    room_id: string
    joined_at: string
    chat_rooms: {
      id: string
      stock_code: string
      stock_name: string
      created_at: string
    }
  }

  const rooms = ((data || []) as unknown as RoomRow[]).map((row) => ({
    id: row.chat_rooms.id,
    stockCode: row.chat_rooms.stock_code,
    stockName: row.chat_rooms.stock_name,
    createdAt: row.chat_rooms.created_at,
  }))

  // 멤버 수 조회
  const roomIds = rooms.map((r) => r.id)
  if (roomIds.length > 0) {
    const { data: counts } = await supabaseAdmin
      .from('chat_room_members')
      .select('room_id')
      .in('room_id', roomIds)

    const countMap: Record<string, number> = {}
    for (const c of counts || []) {
      countMap[c.room_id] = (countMap[c.room_id] || 0) + 1
    }

    return NextResponse.json({
      success: true,
      data: rooms.map((r) => ({ ...r, memberCount: countMap[r.id] || 0 })),
    })
  }

  return NextResponse.json({ success: true, data: [] })
}

// 채팅방 참여 (없으면 생성)
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { stockCode, stockName } = await req.json()

  if (!stockCode || !/^\d{6}$/.test(stockCode)) {
    return NextResponse.json({ success: false, error: '유효한 종목코드가 아닙니다.' }, { status: 400 })
  }
  if (!stockName || stockName.length > 100) {
    return NextResponse.json({ success: false, error: '종목명이 올바르지 않습니다.' }, { status: 400 })
  }

  // 방 upsert
  const { data: room, error: roomError } = await supabaseAdmin
    .from('chat_rooms')
    .upsert(
      { stock_code: stockCode, stock_name: stockName },
      { onConflict: 'stock_code' }
    )
    .select('id, stock_code, stock_name, created_at')
    .single()

  if (roomError || !room) {
    return NextResponse.json({ success: false, error: '채팅방 생성에 실패했습니다.' }, { status: 500 })
  }

  // 멤버 upsert
  await supabaseAdmin
    .from('chat_room_members')
    .upsert(
      { room_id: room.id, user_id: user.id },
      { onConflict: 'room_id,user_id' }
    )

  return NextResponse.json({
    success: true,
    data: {
      id: room.id,
      stockCode: room.stock_code,
      stockName: room.stock_name,
      createdAt: room.created_at,
    },
  })
}
