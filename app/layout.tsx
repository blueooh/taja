import type { Metadata, Viewport } from 'next'
import './globals.css'
import AppShell from '@/components/AppShell'
import PreventPinchZoom from '@/components/PreventPinchZoom'

export const metadata: Metadata = {
  title: '주식 모니터링',
  description: '관심 종목의 실시간 시세를 모니터링하세요',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
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
      <body>
        <PreventPinchZoom />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
