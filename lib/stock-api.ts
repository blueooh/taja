import type { StockQuote, StockSearchResult, TopStock, StockPriceHistory } from './stock-types'

interface NaverStockBasic {
  stockName: string
  closePrice: string
  compareToPreviousClosePrice: string
  fluctuationsRatio: string
  accumulatedTradingVolume: string
  marketValue: string
  highPrice: string
  lowPrice: string
  openPrice: string
  compareToPreviousPrice?: {
    code: string
  }
}

interface NaverRankingStock {
  itemCode: string
  stockName: string
  closePrice: string
  compareToPreviousClosePrice: string
  fluctuationsRatio: string
  accumulatedTradingVolume: string
  marketValueHangeul: string
  itemLogoPngUrl: string
  compareToPreviousPrice?: {
    code: string
  }
}

interface NaverSearchItem {
  reutersCode: string
  stockName: string
  symbolCode: string
  stockExchangeType: {
    name: string
  }
}

export async function getQuotes(codes: string[]): Promise<StockQuote[]> {
  const results = await Promise.allSettled(
    codes.map(async (code) => {
      const res = await fetch(
        `https://m.stock.naver.com/api/stock/${code}/basic`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          next: { revalidate: 0 },
        }
      )
      if (!res.ok) return null

      const data: NaverStockBasic = await res.json()
      const change = parseFloat(data.compareToPreviousClosePrice) || 0
      const changePercent = parseFloat(data.fluctuationsRatio) || 0

      let changeSign: 'up' | 'down' | 'flat' = 'flat'
      if (data.compareToPreviousPrice?.code === '2' || change > 0) changeSign = 'up'
      else if (data.compareToPreviousPrice?.code === '5' || change < 0) changeSign = 'down'

      return {
        code,
        name: data.stockName,
        price: parseInt(data.closePrice?.replace(/,/g, '') || '0', 10),
        change: Math.abs(change),
        changePercent: Math.abs(changePercent),
        changeSign,
        volume: parseInt(data.accumulatedTradingVolume?.replace(/,/g, '') || '0', 10),
        high: parseInt(data.highPrice?.replace(/,/g, '') || '0', 10),
        low: parseInt(data.lowPrice?.replace(/,/g, '') || '0', 10),
        open: parseInt(data.openPrice?.replace(/,/g, '') || '0', 10),
        marketCap: data.marketValue,
      } as StockQuote
    })
  )

  const quotes: StockQuote[] = []
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value !== null) {
      quotes.push(r.value)
    }
  }
  return quotes
}

export async function getTop10(market: 'KOSPI' | 'KOSDAQ'): Promise<TopStock[]> {
  const res = await fetch(
    `https://m.stock.naver.com/api/stocks/marketValue/${market}?page=1&pageSize=10`,
    {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 0 },
    }
  )
  if (!res.ok) return []

  const data = await res.json()
  const stocks = data?.stocks || []

  return stocks.map((s: NaverRankingStock) => {
    const change = parseFloat(s.compareToPreviousClosePrice?.replace(/,/g, '') || '0')
    const changePercent = parseFloat(s.fluctuationsRatio || '0')
    let changeSign: 'up' | 'down' | 'flat' = 'flat'
    if (s.compareToPreviousPrice?.code === '2') changeSign = 'up'
    else if (s.compareToPreviousPrice?.code === '5') changeSign = 'down'

    return {
      code: s.itemCode,
      name: s.stockName,
      price: parseInt(s.closePrice?.replace(/,/g, '') || '0', 10),
      change: Math.abs(change),
      changePercent: Math.abs(changePercent),
      changeSign,
      volume: parseInt(s.accumulatedTradingVolume?.replace(/,/g, '') || '0', 10),
      marketCap: s.marketValueHangeul || '',
      logoUrl: s.itemLogoPngUrl || '',
    }
  })
}

export async function searchStocks(keyword: string): Promise<StockSearchResult[]> {
  const res = await fetch(
    `https://m.stock.naver.com/api/json/search/searchListJson.nhn?keyword=${encodeURIComponent(keyword)}`,
    {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 0 },
    }
  )
  if (!res.ok) return []

  const data = await res.json()
  const items: NaverSearchItem[] = data?.result?.d || []

  return items
    .filter((item) => {
      const code = item.symbolCode || ''
      return /^\d{6}$/.test(code)
    })
    .map((item) => ({
      code: item.symbolCode,
      name: item.stockName,
      market: item.stockExchangeType?.name || 'KOSPI',
    }))
    .slice(0, 20)
}

interface NaverPriceItem {
  localTradedAt: string
  closePrice: string
  openPrice: string
  highPrice: string
  lowPrice: string
  accumulatedTradingVolume: number
}

export async function getPriceHistory(code: string, days: number = 30): Promise<StockPriceHistory[]> {
  const res = await fetch(
    `https://m.stock.naver.com/api/stock/${code}/price?pageSize=${days}`,
    {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 0 },
    }
  )
  if (!res.ok) return []

  const data: NaverPriceItem[] = await res.json()

  return data
    .map((item) => ({
      date: item.localTradedAt,
      close: parseInt(item.closePrice?.replace(/,/g, '') || '0', 10),
      open: parseInt(item.openPrice?.replace(/,/g, '') || '0', 10),
      high: parseInt(item.highPrice?.replace(/,/g, '') || '0', 10),
      low: parseInt(item.lowPrice?.replace(/,/g, '') || '0', 10),
      volume: item.accumulatedTradingVolume || 0,
    }))
    .reverse()
}
