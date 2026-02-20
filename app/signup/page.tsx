'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { USERNAME_REGEX, NICKNAME_REGEX, PASSWORD_MIN } from '@/lib/auth'

export default function SignupPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isValidUsername = USERNAME_REGEX.test(username)
  const isValidPassword = password.length >= PASSWORD_MIN
  const isValidNickname = NICKNAME_REGEX.test(nickname)
  const canSubmit = isValidUsername && isValidPassword && isValidNickname

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, nickname }),
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
        <h2 className="auth-subtitle">회원가입</h2>
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <input
              className="auth-input"
              type="text"
              placeholder="아이디 (영문, 숫자, 밑줄 3-20자)"
              value={username}
              onChange={e => setUsername(e.target.value)}
              maxLength={20}
              autoFocus
              autoComplete="username"
            />
            {username.length > 0 && !isValidUsername && (
              <p className="auth-field-hint">영문, 숫자, 밑줄(_) 3-20자로 입력해주세요.</p>
            )}
          </div>

          <div className="auth-field">
            <input
              className="auth-input"
              type="password"
              placeholder={`비밀번호 (${PASSWORD_MIN}자 이상)`}
              value={password}
              onChange={e => setPassword(e.target.value)}
              maxLength={50}
              autoComplete="new-password"
            />
            {password.length > 0 && !isValidPassword && (
              <p className="auth-field-hint">{PASSWORD_MIN}자 이상 입력해주세요.</p>
            )}
          </div>

          <div className="auth-field">
            <input
              className="auth-input"
              type="text"
              placeholder="닉네임 (한글, 영문, 숫자, 밑줄 1-20자)"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              maxLength={20}
              autoComplete="off"
            />
            {nickname.length > 0 && !isValidNickname && (
              <p className="auth-field-hint">한글, 영문, 숫자, 밑줄(_) 1-20자로 입력해주세요.</p>
            )}
          </div>

          {error && <p className="auth-error">{error}</p>}
          <button
            className="auth-submit-btn"
            type="submit"
            disabled={loading || !canSubmit}
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>
        <p className="auth-link-text">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="auth-link">로그인</Link>
        </p>
      </div>
    </div>
  )
}
