import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { getTop10 } from '@/lib/stock-api'
import type { TopStock } from '@/lib/stock-types'

const CACHE_TTL = 60 // 1분
const CACHE_PREFIX = 'stock:top10:'

export async function GET(req: NextRequest) {
  const market = req.nextUrl.searchParams.get('market') as 'KOSPI' | 'KOSDAQ' | null
  if (!market || !['KOSPI', 'KOSDAQ'].includes(market)) {
    return NextResponse.json({ success: false, error: '시장을 선택해주세요.' }, { status: 400 })
  }

  try {
    const cached = await redis.get(`${CACHE_PREFIX}${market}`)
    if (cached) {
      return NextResponse.json({ success: true, data: JSON.parse(cached) as TopStock[] })
    }

    const data = await getTop10(market)
    await redis.set(`${CACHE_PREFIX}${market}`, JSON.stringify(data), 'EX', CACHE_TTL)

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: '조회에 실패했습니다.' }, { status: 500 })
  }
}
