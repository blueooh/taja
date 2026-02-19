import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '타자 게임',
  description: '빠르고 정확한 타이핑을 연습해보세요!',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
