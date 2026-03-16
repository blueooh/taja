import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { getPriceHistory } from '@/lib/stock-api'

const CACHE_TTL = 60
const CACHE_PREFIX = 'stock:chart:'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30', 10)

  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ success: false, error: '유효한 종목코드를 입력해주세요.' }, { status: 400 })
  }

  const clampedDays = Math.min(Math.max(days, 7), 100)
  const cacheKey = `${CACHE_PREFIX}${code}:${clampedDays}`

  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      return NextResponse.json({ success: true, data: JSON.parse(cached) })
    }

    const data = await getPriceHistory(code, clampedDays)
    if (data.length > 0) {
      await redis.set(cacheKey, JSON.stringify(data), 'EX', CACHE_TTL)
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: '차트 데이터 조회에 실패했습니다.' }, { status: 500 })
  }
}
