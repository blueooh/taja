'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [message, setMessage] = useState('로그인 처리 중...')

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      setMessage('로그인이 취소되었습니다.')
      setTimeout(() => router.replace('/login'), 2000)
      return
    }

    if (!code) {
      router.replace('/login')
      return
    }

    const run = async () => {
      // PKCE 코드를 Supabase 세션으로 교환
      const { data: { session }, error: exchangeErr } =
        await supabase.auth.exchangeCodeForSession(code)

      if (exchangeErr || !session) {
        setMessage('인증에 실패했습니다. 다시 시도해주세요.')
        setTimeout(() => router.replace('/login'), 2000)
        return
      }

      // Supabase 세션 → 우리 커스텀 Redis 세션으로 교환
      const res = await fetch('/api/auth/supabase-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: session.access_token }),
      })
      const json = await res.json()

      if (json.success) {
        router.replace('/')
      } else {
        setMessage(json.error ?? '로그인 실패')
        setTimeout(() => router.replace('/login'), 2000)
      }
    }

    run().catch(() => {
      setMessage('오류가 발생했습니다.')
      setTimeout(() => router.replace('/login'), 2000)
    })
  }, [searchParams, router])

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontFamily: 'inherit',
      color: '#555',
      fontSize: '1rem',
    }}>
      {message}
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackInner />
    </Suspense>
  )
}
