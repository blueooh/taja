import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSession, SESSION_COOKIE } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'

const MAX_WATCHLIST = 50

async function getUser() {
  const jar = await cookies()
  const sid = jar.get(SESSION_COOKIE)?.value
  if (!sid) return null
  return getSession(sid)
}

export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('watchlist')
    .select('id, stock_code, stock_name, market, sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ success: false, error: '목록 조회에 실패했습니다.' }, { status: 500 })
  }

  const items = (data || []).map((row) => ({
    id: row.id,
    stockCode: row.stock_code,
    stockName: row.stock_name,
    market: row.market,
    sortOrder: row.sort_order,
  }))

  return NextResponse.json({ success: true, data: items })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await req.json()
  const { stockCode, stockName, market } = body

  if (!stockCode || !/^\d{6}$/.test(stockCode)) {
    return NextResponse.json({ success: false, error: '유효한 종목코드가 아닙니다.' }, { status: 400 })
  }
  if (!stockName || stockName.length > 100) {
    return NextResponse.json({ success: false, error: '종목명이 올바르지 않습니다.' }, { status: 400 })
  }
  if (!['KOSPI', 'KOSDAQ'].includes(market)) {
    return NextResponse.json({ success: false, error: '유효한 시장이 아닙니다.' }, { status: 400 })
  }

  const { count } = await supabaseAdmin
    .from('watchlist')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) >= MAX_WATCHLIST) {
    return NextResponse.json({ success: false, error: `관심 종목은 최대 ${MAX_WATCHLIST}개까지 등록 가능합니다.` }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('watchlist')
    .upsert(
      {
        user_id: user.id,
        stock_code: stockCode,
        stock_name: stockName,
        market,
        sort_order: (count ?? 0),
      },
      { onConflict: 'user_id,stock_code' }
    )
    .select('id, stock_code, stock_name, market, sort_order')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: '추가에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: {
      id: data.id,
      stockCode: data.stock_code,
      stockName: data.stock_name,
      market: data.market,
      sortOrder: data.sort_order,
    },
  })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const stockCode = req.nextUrl.searchParams.get('stockCode')
  if (!stockCode || !/^\d{6}$/.test(stockCode)) {
    return NextResponse.json({ success: false, error: '유효한 종목코드가 아닙니다.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('watchlist')
    .delete()
    .eq('user_id', user.id)
    .eq('stock_code', stockCode)

  if (error) {
    return NextResponse.json({ success: false, error: '삭제에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
