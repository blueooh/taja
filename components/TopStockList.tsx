'use client'

import { useState, useEffect } from 'react'
import type { TopStock } from '@/lib/stock-types'
import StockPriceCell from './StockPriceCell'

export default function TopStockList() {
  const [market, setMarket] = useState<'KOSPI' | 'KOSDAQ'>('KOSPI')
  const [stocks, setStocks] = useState<TopStock[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/stocks/top?market=${market}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setStocks(json.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [market])

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
          {stocks.map((stock, i) => (
            <div key={stock.code} className="top-stock-item">
              <span className="top-stock-rank">{i + 1}</span>
              <div className="top-stock-info">
                <span className="top-stock-name">{stock.name}</span>
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
          ))}
        </div>
      )}
    </div>
  )
}
