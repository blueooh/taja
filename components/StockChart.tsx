'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { StockPriceHistory } from '@/lib/stock-types'

interface StockChartProps {
  code: string
  name: string
  onClose: () => void
}

type Period = 7 | 30 | 90

export default function StockChart({ code, name, onClose }: StockChartProps) {
  const [period, setPeriod] = useState<Period>(30)
  const [data, setData] = useState<StockPriceHistory[]>([])
  const [loading, setLoading] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const fetchChart = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/stocks/chart?code=${code}&days=${period}`)
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [code, period])

  useEffect(() => {
    fetchChart()
  }, [fetchChart])

  useEffect(() => {
    if (data.length === 0 || !canvasRef.current) return
    drawChart(canvasRef.current, data)
  }, [data])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card stock-chart-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stock-chart-header">
          <h3 className="modal-title">{name} ({code})</h3>
          <div className="stock-chart-periods">
            {([7, 30, 90] as Period[]).map((p) => (
              <button
                key={p}
                className={`stock-chart-period-btn${period === p ? ' stock-chart-period-btn--active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p}일
              </button>
            ))}
          </div>
        </div>

        <div className="stock-chart-body">
          {loading ? (
            <div className="stock-chart-loading">불러오는 중...</div>
          ) : data.length === 0 ? (
            <div className="stock-chart-loading">데이터가 없습니다.</div>
          ) : (
            <canvas ref={canvasRef} className="stock-chart-canvas" />
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="modal-cancel-btn" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}

function drawChart(canvas: HTMLCanvasElement, data: StockPriceHistory[]) {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.parentElement!.getBoundingClientRect()
  const width = rect.width
  const height = 240

  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  const paddingTop = 20
  const paddingBottom = 30
  const paddingLeft = 60
  const paddingRight = 16
  const chartW = width - paddingLeft - paddingRight
  const chartH = height - paddingTop - paddingBottom

  const closes = data.map((d) => d.close)
  const minPrice = Math.min(...closes)
  const maxPrice = Math.max(...closes)
  const priceRange = maxPrice - minPrice || 1
  const pricePadding = priceRange * 0.1

  const yMin = minPrice - pricePadding
  const yMax = maxPrice + pricePadding

  const toX = (i: number) => paddingLeft + (i / (data.length - 1)) * chartW
  const toY = (price: number) => paddingTop + (1 - (price - yMin) / (yMax - yMin)) * chartH

  // background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // grid lines
  ctx.strokeStyle = '#f1f3f4'
  ctx.lineWidth = 1
  const gridCount = 4
  for (let i = 0; i <= gridCount; i++) {
    const y = paddingTop + (chartH / gridCount) * i
    ctx.beginPath()
    ctx.moveTo(paddingLeft, y)
    ctx.lineTo(width - paddingRight, y)
    ctx.stroke()

    const price = yMax - ((yMax - yMin) / gridCount) * i
    ctx.fillStyle = '#9aa0a6'
    ctx.font = '11px Google Sans, Roboto, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(price.toLocaleString('ko-KR'), paddingLeft - 8, y + 4)
  }

  // area fill
  const firstClose = data[0].close
  const lastClose = data[data.length - 1].close
  const isUp = lastClose >= firstClose
  const lineColor = isUp ? '#d93025' : '#1a73e8'
  const fillColor = isUp ? 'rgba(217, 48, 37, 0.08)' : 'rgba(26, 115, 232, 0.08)'

  ctx.beginPath()
  ctx.moveTo(toX(0), toY(data[0].close))
  for (let i = 1; i < data.length; i++) {
    ctx.lineTo(toX(i), toY(data[i].close))
  }
  ctx.lineTo(toX(data.length - 1), paddingTop + chartH)
  ctx.lineTo(toX(0), paddingTop + chartH)
  ctx.closePath()
  ctx.fillStyle = fillColor
  ctx.fill()

  // line
  ctx.beginPath()
  ctx.moveTo(toX(0), toY(data[0].close))
  for (let i = 1; i < data.length; i++) {
    ctx.lineTo(toX(i), toY(data[i].close))
  }
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.stroke()

  // x-axis labels
  ctx.fillStyle = '#9aa0a6'
  ctx.font = '10px Google Sans, Roboto, sans-serif'
  ctx.textAlign = 'center'
  const labelCount = Math.min(5, data.length)
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round((i / (labelCount - 1)) * (data.length - 1))
    const date = data[idx].date.slice(5) // MM-DD
    ctx.fillText(date, toX(idx), height - 8)
  }
}
