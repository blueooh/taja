'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import GamePanel from '@/components/GamePanel'
import ChatBox from '@/components/ChatBox'
import type { AuthUser } from '@/lib/auth'
import { NICKNAME_REGEX } from '@/lib/auth'

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)
  const [typingScoreVersion, setTypingScoreVersion] = useState(0)
  const [acidRainScoreVersion, setAcidRainScoreVersion] = useState(0)
  const [chatOpen, setChatOpen] = useState(true)
  const toggleChat = useCallback(() => setChatOpen(v => !v), [])

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [showNicknameModal, setShowNicknameModal] = useState(false)
  const [newNickname, setNewNickname] = useState('')
  const [nicknameError, setNicknameError] = useState('')
  const [nicknameLoading, setNicknameLoading] = useState(false)

  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawPassword, setWithdrawPassword] = useState('')
  const [withdrawError, setWithdrawError] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(json => setUser(json.success ? json.data : null))
      .catch(() => setUser(null))
  }, [])

  useEffect(() => {
    if (!dropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setDropdownOpen(false)
  }

  const openNicknameModal = () => {
    setNewNickname(user?.nickname ?? '')
    setNicknameError('')
    setShowNicknameModal(true)
    setDropdownOpen(false)
  }

  const handleNicknameChange = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newNickname.trim()
    if (!NICKNAME_REGEX.test(trimmed)) {
      setNicknameError('1~20자의 한글/영문/숫자/_만 사용 가능합니다.')
      return
    }
    setNicknameLoading(true)
    setNicknameError('')
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: trimmed }),
      })
      const json = await res.json()
      if (json.success) {
        setUser(json.data)
        setShowNicknameModal(false)
      } else {
        setNicknameError(json.error ?? '변경에 실패했습니다.')
      }
    } catch {
      setNicknameError('요청에 실패했습니다.')
    } finally {
      setNicknameLoading(false)
    }
  }

  const openWithdrawModal = () => {
    setWithdrawPassword('')
    setWithdrawError('')
    setShowWithdrawModal(true)
    setDropdownOpen(false)
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!withdrawPassword) {
      setWithdrawError('비밀번호를 입력해주세요.')
      return
    }
    setWithdrawLoading(true)
    setWithdrawError('')
    try {
      const res = await fetch('/api/auth/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: withdrawPassword }),
      })
      const json = await res.json()
      if (json.success) {
        setUser(null)
        setShowWithdrawModal(false)
        router.push('/login')
      } else {
        setWithdrawError(json.error ?? '탈퇴에 실패했습니다.')
      }
    } catch {
      setWithdrawError('요청에 실패했습니다.')
    } finally {
      setWithdrawLoading(false)
    }
  }

  const goLogin = () => router.push('/login')

  if (user === undefined) return null

  return (
    <div className="page-wrapper">
      <div className="top-bar">
        {user ? (
          <>
            <div className="top-bar-user-wrap" ref={dropdownRef}>
              <button
                className="top-bar-user"
                onClick={() => setDropdownOpen(v => !v)}
              >
                👤 {user.nickname} ▾
              </button>
              {dropdownOpen && (
                <div className="top-bar-dropdown">
                  <button className="top-bar-dropdown-item" onClick={openNicknameModal}>
                    ✏️ 닉네임 변경
                  </button>
                  <button className="top-bar-dropdown-item top-bar-dropdown-item--danger" onClick={openWithdrawModal}>
                    🗑️ 회원탈퇴
                  </button>
                </div>
              )}
            </div>
            <button className="top-bar-logout" onClick={handleLogout}>로그아웃</button>
          </>
        ) : (
          <button className="top-bar-logout" onClick={goLogin}>로그인</button>
        )}
      </div>

      {showNicknameModal && (
        <div className="modal-backdrop" onClick={() => setShowNicknameModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">닉네임 변경</h3>
            <form onSubmit={handleNicknameChange}>
              <input
                className="auth-input"
                type="text"
                value={newNickname}
                onChange={e => setNewNickname(e.target.value)}
                placeholder="새 닉네임"
                maxLength={20}
                autoFocus
              />
              {nicknameError && <p className="auth-error">{nicknameError}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setShowNicknameModal(false)}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="modal-submit-btn"
                  disabled={nicknameLoading || !newNickname.trim()}
                >
                  {nicknameLoading ? '변경 중...' : '변경'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showWithdrawModal && (
        <div className="modal-backdrop" onClick={() => setShowWithdrawModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">회원탈퇴</h3>
            <p style={{ fontSize: '0.88rem', color: '#666', marginBottom: 16, lineHeight: 1.6 }}>
              탈퇴하면 계정 정보가 <strong>즉시 삭제</strong>되며 복구할 수 없습니다.
              {user?.username
                ? <><br />비밀번호를 입력해 확인해주세요.</>
                : <><br />소셜 계정은 비밀번호 없이 탈퇴됩니다.</>
              }
            </p>
            <form onSubmit={handleWithdraw}>
              {user?.username && (
                <input
                  className="auth-input"
                  type="password"
                  value={withdrawPassword}
                  onChange={e => setWithdrawPassword(e.target.value)}
                  placeholder="비밀번호"
                  autoFocus
                />
              )}
              {withdrawError && <p className="auth-error">{withdrawError}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setShowWithdrawModal(false)}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="modal-submit-btn modal-submit-btn--danger"
                  disabled={withdrawLoading || (!!user?.username && !withdrawPassword)}
                >
                  {withdrawLoading ? '처리 중...' : '탈퇴하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className={`main-layout${chatOpen ? '' : ' main-layout--chat-collapsed'}`}>
        <GamePanel
          user={user}
          onTypingScoreSubmitted={() => setTypingScoreVersion(v => v + 1)}
          onAcidRainScoreSubmitted={() => setAcidRainScoreVersion(v => v + 1)}
          onLogout={handleLogout}
          onNeedAuth={goLogin}
          typingScoreVersion={typingScoreVersion}
          acidRainScoreVersion={acidRainScoreVersion}
        />
        <ChatBox user={user} onNeedAuth={goLogin} isOpen={chatOpen} onToggle={toggleChat} />
      </div>
    </div>
  )
}
