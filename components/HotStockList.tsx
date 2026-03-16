'use client'

import { useState, useEffect, useCallback } from 'react'

interface HotStock {
  stockCode: string
  stockName: string
  messageCount: number
}

interface HotStockListProps {
  onChatClick: (code: string, name: string) => void
}

export default function HotStockList({ onChatClick }: HotStockListProps) {
  const [stocks, setStocks] = useState<HotStock[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHot = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/hot')
      const json = await res.json()
      if (json.success) setStocks(json.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHot()
    const interval = setInterval(fetchHot, 30_000)
    return () => clearInterval(interval)
  }, [fetchHot])

  if (loading) {
    return <div className="hot-stocks-loading">불러오는 중...</div>
  }

  if (stocks.length === 0) {
    return (
      <div className="hot-stocks-empty">
        <p>최근 1시간 동안 대화가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="hot-stocks-list">
      {stocks.map((stock, i) => (
        <div
          key={stock.stockCode}
          className="hot-stock-item"
          onClick={() => onChatClick(stock.stockCode, stock.stockName)}
        >
          <span className="hot-stock-rank">{i + 1}</span>
          <div className="hot-stock-info">
            <span className="hot-stock-name">{stock.stockName}</span>
            <span className="hot-stock-meta">{stock.stockCode}</span>
          </div>
          <span className="hot-stock-count">💬 {stock.messageCount}</span>
        </div>
      ))}
    </div>
  )
}
