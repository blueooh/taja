'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [message, setMessage] = useState('로그인 처리 중...')

  useEffect(() => {
    let done = false

    const exchange = async (accessToken: string) => {
      if (done) return
      done = true

      try {
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
      } catch {
        setMessage('네트워크 오류가 발생했습니다.')
        setTimeout(() => router.replace('/login'), 2000)
      }
    }

    // PKCE 방식은 클라이언트 초기화 시 이미 코드 교환이 완료될 수 있음
    // → getSession()으로 먼저 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) exchange(session.access_token)
    })

    // getSession()에 세션이 없으면 onAuthStateChange로 대기
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          subscription.unsubscribe()
          exchange(session.access_token)
        }
      }
    )

    return () => { subscription.unsubscribe() }
  }, [router])

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
