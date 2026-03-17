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

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    // 최근 1시간 메시지 집계
    const { data: recentMessages, error: recentError } = await supabaseAdmin
      .from('chat_messages')
      .select('room_id')
      .gte('created_at', oneHourAgo)

    if (recentError) {
      return NextResponse.json({ success: false, error: '조회에 실패했습니다.' }, { status: 500 })
    }

    // 방별 최근 1시간 메시지 수
    const recentCountMap: Record<string, number> = {}
    for (const row of recentMessages || []) {
      recentCountMap[row.room_id] = (recentCountMap[row.room_id] || 0) + 1
    }

    // 최근 1시간 대화수 기준 정렬, TOP 10
    const sorted = Object.entries(recentCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    if (sorted.length === 0) {
      await redis.set(CACHE_KEY, '[]', 'EX', CACHE_TTL)
      return NextResponse.json({ success: true, data: [] })
    }

    const roomIds = sorted.map(([id]) => id)

    // 방 정보 조회
    const { data: rooms } = await supabaseAdmin
      .from('chat_rooms')
      .select('id, stock_code, stock_name')
      .in('id', roomIds)

    const roomMap: Record<string, { stockCode: string; stockName: string }> = {}
    for (const r of rooms || []) {
      roomMap[r.id] = { stockCode: r.stock_code, stockName: r.stock_name }
    }

    // 토탈 메시지 수 조회
    const { data: totalMessages } = await supabaseAdmin
      .from('chat_messages')
      .select('room_id')
      .in('room_id', roomIds)

    const totalCountMap: Record<string, number> = {}
    for (const row of totalMessages || []) {
      totalCountMap[row.room_id] = (totalCountMap[row.room_id] || 0) + 1
    }

    const result = sorted
      .filter(([id]) => roomMap[id])
      .map(([id, recentCount]) => ({
        stockCode: roomMap[id].stockCode,
        stockName: roomMap[id].stockName,
        recentCount,
        totalCount: totalCountMap[id] || 0,
      }))

    await redis.set(CACHE_KEY, JSON.stringify(result), 'EX', CACHE_TTL)
    return NextResponse.json({ success: true, data: result })
  } catch {
    return NextResponse.json({ success: false, error: '조회에 실패했습니다.' }, { status: 500 })
  }
}
