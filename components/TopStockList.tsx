'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { TopStock } from '@/lib/stock-types'
import StockPriceCell from './StockPriceCell'

const REFRESH_INTERVAL = 3_000

interface TopStockListProps {
  watchlistCodes: Set<string>
  onToggleWatchlist: (stock: { code: string; name: string; market: string }) => void
  onStockClick: (code: string, name: string) => void
}

export default function TopStockList({ watchlistCodes, onToggleWatchlist, onStockClick }: TopStockListProps) {
  const [market, setMarket] = useState<'KOSPI' | 'KOSDAQ'>('KOSPI')
  const [stocks, setStocks] = useState<TopStock[]>([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const fetchStocks = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const res = await fetch(`/api/stocks/top?market=${market}`)
      const json = await res.json()
      if (json.success) setStocks(json.data)
    } catch {
      // ignore
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [market])

  useEffect(() => {
    fetchStocks(true)
    intervalRef.current = setInterval(() => fetchStocks(), REFRESH_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchStocks])

  return (
    <div className="top-stocks">
      <div className="top-stocks-tabs">
        <button
          className={`top-stocks-tab${market === 'KOSPI' ? ' top-stocks-tab--active' : ''}`}
          onClick={() => setMarket('KOSPI')}
        >
          코스피 TOP 10
        </button>
        <button
          className={`top-stocks-tab${market === 'KOSDAQ' ? ' top-stocks-tab--active' : ''}`}
          onClick={() => setMarket('KOSDAQ')}
        >
          코스닥 TOP 10
        </button>
      </div>

      {loading ? (
        <div className="top-stocks-loading">불러오는 중...</div>
      ) : (
        <div className="top-stocks-list">
          {stocks.map((stock, i) => {
            const isWatched = watchlistCodes.has(stock.code)
            return (
              <div key={stock.code} className="top-stock-item" onClick={() => onStockClick(stock.code, stock.name)} style={{ cursor: 'pointer' }}>
                <span className="top-stock-rank">{i + 1}</span>
                <div className="top-stock-info">
                  <span className="top-stock-name">
                    {stock.name}
                    <button
                      className={`star-btn${isWatched ? ' star-btn--active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onToggleWatchlist({ code: stock.code, name: stock.name, market }) }}
                      title={isWatched ? '관심 해제' : '관심 추가'}
                    >
                      {isWatched ? '★' : '☆'}
                    </button>
                  </span>
                  <span className="top-stock-meta">{stock.code} · {stock.marketCap}</span>
                </div>
                <div className="top-stock-price">
                  <StockPriceCell
                    price={stock.price}
                    change={stock.change}
                    changePercent={stock.changePercent}
                    changeSign={stock.changeSign}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
