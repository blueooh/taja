'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { WatchlistItem, StockQuote } from '@/lib/stock-types'
import StockPriceCell from './StockPriceCell'

interface WatchlistTableProps {
  items: WatchlistItem[]
  onToggleWatchlist: (stock: { code: string; name: string; market: string }) => void
  onStockClick: (code: string, name: string) => void
}

export default function WatchlistTable({ items, onToggleWatchlist, onStockClick }: WatchlistTableProps) {
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({})
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const fetchQuotes = useCallback(async () => {
    if (items.length === 0) return
    const codes = items.map((i) => i.stockCode).join(',')
    setLoading(true)
    try {
      const res = await fetch(`/api/stocks/quote?codes=${codes}`)
      const json = await res.json()
      if (json.success) {
        const map: Record<string, StockQuote> = {}
        for (const q of json.data) {
          map[q.code] = q
        }
        setQuotes(map)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [items])

  useEffect(() => {
    fetchQuotes()
    intervalRef.current = setInterval(fetchQuotes, 30_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchQuotes])

  if (items.length === 0) {
    return (
      <div className="watchlist-empty">
        <p>관심 종목이 없습니다.</p>
        <p>종목을 검색해서 추가해보세요.</p>
      </div>
    )
  }

  return (
    <div className="watchlist-table-wrap">
      <table className="watchlist-table">
        <thead>
          <tr>
            <th className="watchlist-th watchlist-th--name">종목명</th>
            <th className="watchlist-th watchlist-th--price">현재가</th>
            <th className="watchlist-th watchlist-th--volume">거래량</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const quote = quotes[item.stockCode]
            return (
              <tr key={item.stockCode} className="watchlist-row" onClick={() => onStockClick(item.stockCode, item.stockName)} style={{ cursor: 'pointer' }}>
                <td className="watchlist-td watchlist-td--name">
                  <span className="watchlist-stock-name">
                    {item.stockName}
                    <button
                      className="star-btn star-btn--active"
                      onClick={(e) => { e.stopPropagation(); onToggleWatchlist({
                        code: item.stockCode,
                        name: item.stockName,
                        market: item.market,
                      }) }}
                      title="관심 해제"
                    >
                      ★
                    </button>
                  </span>
                  <span className="watchlist-stock-code">{item.stockCode}</span>
                </td>
                <td className="watchlist-td watchlist-td--price">
                  {quote ? (
                    <StockPriceCell
                      price={quote.price}
                      change={quote.change}
                      changePercent={quote.changePercent}
                      changeSign={quote.changeSign}
                    />
                  ) : (
                    <span className="watchlist-loading-text">{loading ? '...' : '-'}</span>
                  )}
                </td>
                <td className="watchlist-td watchlist-td--volume">
                  {quote ? quote.volume.toLocaleString('ko-KR') : '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
