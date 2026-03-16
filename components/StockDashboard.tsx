'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/app-context'
import type { WatchlistItem } from '@/lib/stock-types'
import TopStockList from './TopStockList'
import WatchlistTable from './WatchlistTable'
import StockSearchModal from './StockSearchModal'
import StockChart from './StockChart'
import StockChatRoom from './StockChatRoom'
import ChatRoomList from './ChatRoomList'

type Tab = 'top' | 'watchlist'

export default function StockDashboard() {
  const { user, onNeedAuth } = useApp()
  const [tab, setTab] = useState<Tab>('top')
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [watchlistLoaded, setWatchlistLoaded] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [chartStock, setChartStock] = useState<{ code: string; name: string } | null>(null)
  const [chatStock, setChatStock] = useState<{ code: string; name: string } | null>(null)
  const [showChatList, setShowChatList] = useState(false)

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
    if (user && !watchlistLoaded) {
      fetchWatchlist()
    }
  }, [user, watchlistLoaded, fetchWatchlist])

  const handleTabChange = (next: Tab) => {
    if (next === 'watchlist' && !user) {
      onNeedAuth()
      return
    }
    setTab(next)
  }

  const existingCodes = new Set(items.map((i) => i.stockCode))

  const handleToggleWatchlist = async (stock: { code: string; name: string; market: string }) => {
    if (!user) {
      onNeedAuth()
      return
    }

    const isRemoving = existingCodes.has(stock.code)
    const prevItems = items

    if (isRemoving) {
      setItems((prev) => prev.filter((i) => i.stockCode !== stock.code))
      try {
        const res = await fetch(`/api/watchlist?stockCode=${stock.code}`, { method: 'DELETE' })
        const json = await res.json()
        if (!json.success) setItems(prevItems)
      } catch {
        setItems(prevItems)
      }
    } else {
      const optimisticItem: WatchlistItem = {
        id: `temp-${stock.code}`,
        stockCode: stock.code,
        stockName: stock.name,
        market: (stock.market.includes('KOSDAQ') ? 'KOSDAQ' : 'KOSPI') as 'KOSPI' | 'KOSDAQ',
        sortOrder: items.length,
      }
      setItems((prev) => [...prev, optimisticItem])
      try {
        const res = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stockCode: stock.code,
            stockName: stock.name,
            market: optimisticItem.market,
          }),
        })
        const json = await res.json()
        if (json.success) {
          setItems((prev) => prev.map((i) => i.id === optimisticItem.id ? json.data : i))
        } else {
          setItems(prevItems)
        }
      } catch {
        setItems(prevItems)
      }
    }
  }

  const handleChatClick = (code: string, name: string) => {
    if (!user) {
      onNeedAuth()
      return
    }
    setChatStock({ code, name })
  }

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
        {user && (
          <button
            className="stock-dashboard-tab stock-dashboard-tab--chat"
            onClick={() => setShowChatList(true)}
          >
            톡방
          </button>
        )}
      </div>

      {tab === 'top' && (
        <TopStockList
          watchlistCodes={existingCodes}
          onToggleWatchlist={handleToggleWatchlist}
          onStockClick={(code, name) => setChartStock({ code, name })}
          onChatClick={handleChatClick}
        />
      )}

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
            <WatchlistTable
              items={items}
              onToggleWatchlist={handleToggleWatchlist}
              onStockClick={(code, name) => setChartStock({ code, name })}
              onChatClick={handleChatClick}
            />
          )}

          {showSearch && (
            <StockSearchModal
              onClose={() => setShowSearch(false)}
              onToggleWatchlist={handleToggleWatchlist}
              existingCodes={existingCodes}
            />
          )}
        </div>
      )}

      {chartStock && (
        <StockChart
          code={chartStock.code}
          name={chartStock.name}
          onClose={() => setChartStock(null)}
        />
      )}

      {chatStock && (
        <StockChatRoom
          stockCode={chatStock.code}
          stockName={chatStock.name}
          onClose={() => setChatStock(null)}
        />
      )}

      {showChatList && (
        <ChatRoomList
          onOpenRoom={(code, name) => handleChatClick(code, name)}
          onClose={() => setShowChatList(false)}
        />
      )}
    </div>
  )
}
