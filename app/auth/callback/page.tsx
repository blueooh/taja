'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [message, setMessage] = useState('로그인 처리 중...')

  useEffect(() => {
    let done = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (done) return
        if (event !== 'SIGNED_IN' || !session) return

        done = true
        subscription.unsubscribe()

        try {
          const res = await fetch('/api/auth/supabase-callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: session.access_token }),
          })
          const json = await res.json()

          if (json.success) {
            // Supabase Auth 세션은 우리가 사용하지 않으므로 정리
            await supabase.auth.signOut()
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
    )

    return () => { if (!done) subscription.unsubscribe() }
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
