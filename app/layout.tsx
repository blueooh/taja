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
      <head>
        <meta name="google-adsense-account" content="ca-pub-9997761269602279" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9997761269602279"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
