'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">타짜</h1>
        <h2 className="auth-subtitle">로그인</h2>
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
