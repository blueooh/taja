import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { getQuotes } from '@/lib/stock-api'
import type { StockQuote } from '@/lib/stock-types'

const CACHE_TTL = 30 // 30초
const CACHE_PREFIX = 'stock:quote:'

export async function GET(req: NextRequest) {
  const codesParam = req.nextUrl.searchParams.get('codes')
  if (!codesParam) {
    return NextResponse.json({ success: false, error: '종목코드를 입력해주세요.' }, { status: 400 })
  }

  const codes = codesParam.split(',').filter((c) => /^\d{6}$/.test(c.trim())).map((c) => c.trim())
  if (codes.length === 0) {
    return NextResponse.json({ success: false, error: '유효한 종목코드가 없습니다.' }, { status: 400 })
  }

  try {
    const cached: (StockQuote | null)[] = []
    const uncachedCodes: string[] = []

    for (const code of codes) {
      const data = await redis.get(`${CACHE_PREFIX}${code}`)
      if (data) {
        cached.push(JSON.parse(data) as StockQuote)
      } else {
        cached.push(null)
        uncachedCodes.push(code)
      }
    }

    let freshQuotes: StockQuote[] = []
    if (uncachedCodes.length > 0) {
      freshQuotes = await getQuotes(uncachedCodes)
      for (const quote of freshQuotes) {
        await redis.set(`${CACHE_PREFIX}${quote.code}`, JSON.stringify(quote), 'EX', CACHE_TTL)
      }
    }

    const result = codes.map((code) => {
      const fromCache = cached.find((c) => c?.code === code)
      if (fromCache) return fromCache
      return freshQuotes.find((q) => q.code === code) ?? null
    }).filter((q): q is StockQuote => q !== null)

    return NextResponse.json({ success: true, data: result })
  } catch {
    return NextResponse.json({ success: false, error: '시세 조회에 실패했습니다.' }, { status: 500 })
  }
}
