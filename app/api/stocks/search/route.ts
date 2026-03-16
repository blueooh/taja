import { NextRequest, NextResponse } from 'next/server'
import { searchStocks } from '@/lib/stock-api'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1) {
    return NextResponse.json({ success: false, error: '검색어를 입력해주세요.' }, { status: 400 })
  }

  try {
    const results = await searchStocks(q)
    return NextResponse.json({ success: true, data: results })
  } catch {
    return NextResponse.json({ success: false, error: '검색에 실패했습니다.' }, { status: 500 })
  }
}
