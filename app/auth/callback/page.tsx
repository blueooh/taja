'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [message, setMessage] = useState('로그인 처리 중...')

  useEffect(() => {
    const error = searchParams.get('error')

    if (error) {
      setMessage('로그인이 취소되었습니다.')
      setTimeout(() => router.replace('/login'), 2000)
      return
    }

    let handled = false

    const handleSession = async (accessToken: string) => {
      if (handled) return
      handled = true

      const res = await fetch('/api/auth/supabase-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken }),
      })
      const json = await res.json()

      if (json.success) {
        router.replace('/')
      } else {
        setMessage(json.error ?? '로그인 실패')
        setTimeout(() => router.replace('/login'), 2000)
      }
    }

    // detectSessionInUrl: true (default) auto-exchanges the PKCE code.
    // Listen for the resulting SIGNED_IN event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
          subscription.unsubscribe()
          await handleSession(session.access_token)
        }
      }
    )

    // Also check immediately in case auto-exchange already completed
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe()
        handleSession(session.access_token)
      }
    })

    const timeout = setTimeout(() => {
      if (!handled) {
        setMessage('인증 시간이 초과되었습니다.')
        setTimeout(() => router.replace('/login'), 2000)
      }
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router, searchParams])

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
