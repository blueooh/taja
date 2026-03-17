import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { supabaseAdmin } from '@/lib/supabase-admin'

const CACHE_KEY = 'chat:hot'
const CACHE_TTL = 30

export async function GET() {
  try {
    const cached = await redis.get(CACHE_KEY)
    if (cached) {
      return NextResponse.json({ success: true, data: JSON.parse(cached) })
    }

    // 대화가 있는 모든 방 + 토탈 메시지 수 집계
    const { data: allMessages, error: allError } = await supabaseAdmin
      .from('chat_messages')
      .select('room_id')

    if (allError) {
      return NextResponse.json({ success: false, error: '조회에 실패했습니다.' }, { status: 500 })
    }

    const totalCountMap: Record<string, number> = {}
    for (const row of allMessages || []) {
      totalCountMap[row.room_id] = (totalCountMap[row.room_id] || 0) + 1
    }

    const allRoomIds = Object.keys(totalCountMap)
    if (allRoomIds.length === 0) {
      await redis.set(CACHE_KEY, '[]', 'EX', CACHE_TTL)
      return NextResponse.json({ success: true, data: [] })
    }

    // 최근 1시간 메시지 집계
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recentMessages } = await supabaseAdmin
      .from('chat_messages')
      .select('room_id')
      .gte('created_at', oneHourAgo)

    const recentCountMap: Record<string, number> = {}
    for (const row of recentMessages || []) {
      recentCountMap[row.room_id] = (recentCountMap[row.room_id] || 0) + 1
    }

    // 방 정보 조회
    const { data: rooms } = await supabaseAdmin
      .from('chat_rooms')
      .select('id, stock_code, stock_name')
      .in('id', allRoomIds)

    const roomMap: Record<string, { stockCode: string; stockName: string }> = {}
    for (const r of rooms || []) {
      roomMap[r.id] = { stockCode: r.stock_code, stockName: r.stock_name }
    }

    // 최근 1시간 대화수 기준 정렬, 모든 방 포함
    const result = allRoomIds
      .filter((id) => roomMap[id])
      .sort((a, b) => (recentCountMap[b] || 0) - (recentCountMap[a] || 0))
      .slice(0, 20)
      .map((id) => ({
        stockCode: roomMap[id].stockCode,
        stockName: roomMap[id].stockName,
        recentCount: recentCountMap[id] || 0,
        totalCount: totalCountMap[id] || 0,
      }))

    await redis.set(CACHE_KEY, JSON.stringify(result), 'EX', CACHE_TTL)
    return NextResponse.json({ success: true, data: result })
  } catch {
    return NextResponse.json({ success: false, error: '조회에 실패했습니다.' }, { status: 500 })
  }
}
