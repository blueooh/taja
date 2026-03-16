'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { StockSearchResult } from '@/lib/stock-types'

interface StockSearchModalProps {
  onClose: () => void
  onAdd: (stock: StockSearchResult) => void
  existingCodes: Set<string>
}

export default function StockSearchModal({ onClose, onAdd, existingCodes }: StockSearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StockSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q.trim())}`)
      const json = await res.json()
      if (json.success) {
        setResults(json.data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(value), 300)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card stock-search-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">종목 검색</h3>
        <input
          ref={inputRef}
          className="auth-input"
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="종목명 또는 종목코드 검색"
        />

        <div className="stock-search-results">
          {loading && <div className="stock-search-loading">검색 중...</div>}
          {!loading && query && results.length === 0 && (
            <div className="stock-search-empty">검색 결과가 없습니다.</div>
          )}
          {results.map((stock) => {
            const isAdded = existingCodes.has(stock.code)
            return (
              <button
                key={stock.code}
                className={`stock-search-item${isAdded ? ' stock-search-item--added' : ''}`}
                onClick={() => !isAdded && onAdd(stock)}
                disabled={isAdded}
              >
                <span className="stock-search-item-name">{stock.name}</span>
                <span className="stock-search-item-code">{stock.code}</span>
                <span className="stock-search-item-market">{stock.market}</span>
                {isAdded && <span className="stock-search-item-badge">추가됨</span>}
              </button>
            )
          })}
        </div>

        <div className="modal-actions">
          <button type="button" className="modal-cancel-btn" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
