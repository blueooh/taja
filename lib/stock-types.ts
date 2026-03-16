export interface StockQuote {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
  changeSign: 'up' | 'down' | 'flat'
  volume: number
  high: number
  low: number
  open: number
  marketCap?: string
}

export interface WatchlistItem {
  id: string
  stockCode: string
  stockName: string
  market: 'KOSPI' | 'KOSDAQ'
  sortOrder: number
}

export interface TopStock {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
  changeSign: 'up' | 'down' | 'flat'
  volume: number
  marketCap: string
  logoUrl: string
}

export interface StockSearchResult {
  code: string
  name: string
  market: string
}
