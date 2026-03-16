import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { supabaseAdmin } from '@/lib/supabase-admin'

const CACHE_KEY = 'chat:hot'
const CACHE_TTL = 30 // 30초

export async function GET() {
  try {
    const cached = await redis.get(CACHE_KEY)
    if (cached) {
      return NextResponse.json({ success: true, data: JSON.parse(cached) })
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { data, error } = await supabaseAdmin
      .rpc('get_hot_chat_rooms', { since: oneHourAgo })

    if (error) {
      // rpc가 없으면 직접 쿼리
      const { data: fallback, error: fallbackError } = await supabaseAdmin
        .from('chat_messages')
        .select('room_id')
        .gte('created_at', oneHourAgo)

      if (fallbackError) {
        return NextResponse.json({ success: false, error: '조회에 실패했습니다.' }, { status: 500 })
      }

      // 방별 메시지 수 집계
      const countMap: Record<string, number> = {}
      for (const row of fallback || []) {
        countMap[row.room_id] = (countMap[row.room_id] || 0) + 1
      }

      const sorted = Object.entries(countMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)

      if (sorted.length === 0) {
        await redis.set(CACHE_KEY, '[]', 'EX', CACHE_TTL)
        return NextResponse.json({ success: true, data: [] })
      }

      const roomIds = sorted.map(([id]) => id)
      const { data: rooms } = await supabaseAdmin
        .from('chat_rooms')
        .select('id, stock_code, stock_name')
        .in('id', roomIds)

      const roomMap: Record<string, { stockCode: string; stockName: string }> = {}
      for (const r of rooms || []) {
        roomMap[r.id] = { stockCode: r.stock_code, stockName: r.stock_name }
      }

      const result = sorted
        .filter(([id]) => roomMap[id])
        .map(([id, count]) => ({
          stockCode: roomMap[id].stockCode,
          stockName: roomMap[id].stockName,
          messageCount: count,
        }))

      await redis.set(CACHE_KEY, JSON.stringify(result), 'EX', CACHE_TTL)
      return NextResponse.json({ success: true, data: result })
    }

    await redis.set(CACHE_KEY, JSON.stringify(data), 'EX', CACHE_TTL)
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: '조회에 실패했습니다.' }, { status: 500 })
  }
}
