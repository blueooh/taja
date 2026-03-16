'use client'

interface StockPriceCellProps {
  price: number
  change: number
  changePercent: number
  changeSign: 'up' | 'down' | 'flat'
}

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR')
}

export default function StockPriceCell({ price, change, changePercent, changeSign }: StockPriceCellProps) {
  const colorClass =
    changeSign === 'up' ? 'price-up' : changeSign === 'down' ? 'price-down' : 'price-flat'
  const sign = changeSign === 'up' ? '+' : changeSign === 'down' ? '-' : ''

  return (
    <div className={`stock-price-cell ${colorClass}`}>
      <span className="stock-price-current">{formatNumber(price)}</span>
      <span className="stock-price-change">
        {sign}{formatNumber(change)} ({sign}{changePercent.toFixed(2)}%)
      </span>
    </div>
  )
}
