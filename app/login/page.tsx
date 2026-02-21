'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const oauthError = searchParams.get('error')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(oauthError ?? '')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'kakao' | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const json = await res.json()
      if (json.success) {
        router.replace('/')
      } else {
        setError(json.error)
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: 'google' | 'kakao') => {
    setOauthLoading(provider)
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    setOauthLoading(null)
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">타짜</h1>
        <h2 className="auth-subtitle">로그인</h2>

        <div className="oauth-buttons">
          <button
            className="oauth-btn oauth-btn--google"
            onClick={() => handleOAuth('google')}
            disabled={!!oauthLoading}
          >
            <GoogleIcon />
            {oauthLoading === 'google' ? '이동 중...' : 'Google로 로그인'}
          </button>
          <button
            className="oauth-btn oauth-btn--kakao"
            onClick={() => handleOAuth('kakao')}
            disabled={!!oauthLoading}
          >
            <KakaoIcon />
            {oauthLoading === 'kakao' ? '이동 중...' : '카카오로 로그인'}
          </button>
        </div>

        <div className="auth-divider"><span>또는</span></div>

        <form onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type="text"
            placeholder="아이디"
            value={username}
            onChange={e => setUsername(e.target.value)}
            maxLength={20}
            autoFocus
            autoComplete="username"
          />
          <input
            className="auth-input"
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={e => setPassword(e.target.value)}
            maxLength={50}
            autoComplete="current-password"
          />
          {error && <p className="auth-error">{error}</p>}
          <button
            className="auth-submit-btn"
            type="submit"
            disabled={loading || !username || !password}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
        <p className="auth-link-text">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="auth-link">회원가입</Link>
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}


function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 1.5C4.86 1.5 1.5 4.08 1.5 7.26c0 2.04 1.35 3.84 3.39 4.86l-.87 3.21c-.06.21.18.39.36.27L8.1 13.2c.3.03.6.06.9.06 4.14 0 7.5-2.58 7.5-5.76S13.14 1.5 9 1.5z" fill="#3C1E1E"/>
    </svg>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
