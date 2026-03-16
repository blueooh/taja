'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/app-context'
import type { WatchlistItem, StockSearchResult } from '@/lib/stock-types'
import TopStockList from './TopStockList'
import WatchlistTable from './WatchlistTable'
import StockSearchModal from './StockSearchModal'

type Tab = 'top' | 'watchlist'

export default function StockDashboard() {
  const { user, onNeedAuth } = useApp()
  const [tab, setTab] = useState<Tab>('top')
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [watchlistLoaded, setWatchlistLoaded] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch('/api/watchlist')
      const json = await res.json()
      if (json.success) {
        setItems(json.data)
      }
    } catch {
      // ignore
    } finally {
      setWatchlistLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (tab === 'watchlist' && user && !watchlistLoaded) {
      fetchWatchlist()
    }
  }, [tab, user, watchlistLoaded, fetchWatchlist])

  const handleTabChange = (next: Tab) => {
    if (next === 'watchlist' && !user) {
      onNeedAuth()
      return
    }
    setTab(next)
  }

  const handleAdd = async (stock: StockSearchResult) => {
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockCode: stock.code,
          stockName: stock.name,
          market: stock.market.includes('KOSDAQ') ? 'KOSDAQ' : 'KOSPI',
        }),
      })
      const json = await res.json()
      if (json.success) {
        setItems((prev) => [...prev, json.data])
      }
    } catch {
      // ignore
    }
  }

  const handleRemove = async (stockCode: string) => {
    try {
      const res = await fetch(`/api/watchlist?stockCode=${stockCode}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        setItems((prev) => prev.filter((i) => i.stockCode !== stockCode))
      }
    } catch {
      // ignore
    }
  }

  const existingCodes = new Set(items.map((i) => i.stockCode))

  return (
    <div className="stock-dashboard">
      <div className="stock-dashboard-tabs">
        <button
          className={`stock-dashboard-tab${tab === 'top' ? ' stock-dashboard-tab--active' : ''}`}
          onClick={() => handleTabChange('top')}
        >
          시가총액 TOP
        </button>
        <button
          className={`stock-dashboard-tab${tab === 'watchlist' ? ' stock-dashboard-tab--active' : ''}`}
          onClick={() => handleTabChange('watchlist')}
        >
          관심 종목
        </button>
      </div>

      {tab === 'top' && <TopStockList />}

      {tab === 'watchlist' && (
        <div className="stock-watchlist-section">
          <div className="stock-watchlist-header">
            <button className="stock-add-btn" onClick={() => setShowSearch(true)}>
              + 종목 추가
            </button>
          </div>

          {!watchlistLoaded ? (
            <div className="stock-dashboard-loading">불러오는 중...</div>
          ) : (
            <WatchlistTable items={items} onRemove={handleRemove} />
          )}

          {showSearch && (
            <StockSearchModal
              onClose={() => setShowSearch(false)}
              onAdd={handleAdd}
              existingCodes={existingCodes}
            />
          )}
        </div>
      )}
    </div>
  )
}
