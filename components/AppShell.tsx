'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import ChatBox from '@/components/ChatBox'
import { AppContext } from '@/lib/app-context'
import type { AuthUser } from '@/lib/auth'
import { NICKNAME_REGEX } from '@/lib/auth'

const GAME_META: Record<string, { icon: string; name: string }> = {
  '/typing':   { icon: '⌨️', name: '스피드 타자' },
  '/acidrain': { icon: '🌧️', name: '산성비'       },
  '/battle':   { icon: '⚔️', name: '1:1 배틀'    },
  '/gomoku':   { icon: '⚫', name: '오목'         },
  '/gostop':   { icon: '🎴', name: '고스톱'       },
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('auth_user')
      if (cached) setUser(JSON.parse(cached) as AuthUser)
    } catch {
      // ignore
    }
  }, [])

  // 채팅 드로어
  const [chatOpen, setChatOpen] = useState(false)
  const [chatHasUnread, setChatHasUnread] = useState(false)
  const toggleChat = useCallback(() => setChatOpen(v => !v), [])
  const closeChat = useCallback(() => setChatOpen(false), [])

  // 유저 드롭다운
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 닉네임 모달
  const [showNicknameModal, setShowNicknameModal] = useState(false)
  const [newNickname, setNewNickname] = useState('')
  const [nicknameError, setNicknameError] = useState('')
  const [nicknameLoading, setNicknameLoading] = useState(false)

  // 회원탈퇴 모달
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawPassword, setWithdrawPassword] = useState('')
  const [withdrawError, setWithdrawError] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)

  const fetchUser = useCallback(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(json => {
        const u = json.success ? json.data : null
        setUser(u)
        if (u) sessionStorage.setItem('auth_user', JSON.stringify(u))
        else sessionStorage.removeItem('auth_user')
      })
      .catch(() => setUser(null))
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser, pathname])

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

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // 네트워크 오류여도 클라이언트 상태 초기화
    } finally {
      setUser(null)
      sessionStorage.removeItem('auth_user')
      setDropdownOpen(false)
    }
  }, [])

  const onNeedAuth = useCallback(() => router.push('/login'), [router])

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
    if (!user?.isSocial && !withdrawPassword) {
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

  const currentGame = GAME_META[pathname]

  return (
    <AppContext.Provider value={{ user, onNeedAuth, onLogout: handleLogout }}>
      <div className="app-shell">

        {/* ===== 헤더 ===== */}
        <header className="app-header">
          <div className="app-header-left">
            <Link href="/" className="app-header-logo">타짜</Link>
            {currentGame && (
              <span className="app-header-game-title">
                {currentGame.icon} {currentGame.name}
              </span>
            )}
          </div>
          <div className="app-header-right">
            <button
              className={`app-header-chat-btn${chatOpen ? ' app-header-chat-btn--active' : ''}`}
              onClick={() => user ? toggleChat() : router.push('/login')}
            >
              💬 타짜톡
              {chatHasUnread && !chatOpen && <span className="app-header-chat-unread" />}
            </button>

            <div className="top-bar-user-wrap" ref={dropdownRef}>
              {user === undefined ? (
                <div className="top-bar-icon-btn" />
              ) : (
                <button
                  className={`top-bar-icon-btn${user ? ' top-bar-avatar' : ''}`}
                  onClick={() => user ? setDropdownOpen(v => !v) : router.push('/login')}
                  title={user?.nickname ?? '로그인'}
                >
                  {user ? user.nickname[0].toUpperCase() : '👤'}
                </button>
              )}
              {user && dropdownOpen && (
                <div className="top-bar-dropdown">
                  <div className="top-bar-dropdown-user">
                    <span className="top-bar-dropdown-nickname">{user.nickname}</span>
                    <span className="top-bar-dropdown-username">@{user.username}</span>
                  </div>
                  <div style={{ height: 1, background: '#e8eaed', margin: '4px 0' }} />
                  <button className="top-bar-dropdown-item" onClick={openNicknameModal}>
                    ✏️ 닉네임 변경
                  </button>
                  <button className="top-bar-dropdown-item top-bar-dropdown-item--danger" onClick={openWithdrawModal}>
                    🗑️ 회원탈퇴
                  </button>
                  <div style={{ height: 1, background: '#e8eaed', margin: '4px 0' }} />
                  <button className="top-bar-dropdown-item" onClick={handleLogout}>
                    🚪 로그아웃
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ===== 메인 ===== */}
        <main className={`app-main${currentGame ? ' app-main--game' : ''}`}>
          {children}
        </main>

        {/* ===== 채팅 드로어 ===== */}
        <div
          className={`chat-drawer-backdrop${chatOpen ? ' chat-drawer-backdrop--open' : ''}`}
          onClick={closeChat}
        />
        <aside className={`chat-drawer${chatOpen ? ' chat-drawer--open' : ''}`}>
          <ChatBox
            user={user ?? null}
            onNeedAuth={onNeedAuth}
            isOpen={chatOpen}
            onToggle={toggleChat}
            onUnreadChange={setChatHasUnread}
          />
        </aside>

        {/* ===== 닉네임 변경 모달 ===== */}
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
                  <button type="button" className="modal-cancel-btn" onClick={() => setShowNicknameModal(false)}>
                    취소
                  </button>
                  <button type="submit" className="modal-submit-btn" disabled={nicknameLoading || !newNickname.trim()}>
                    {nicknameLoading ? '변경 중...' : '변경'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===== 회원탈퇴 모달 ===== */}
        {showWithdrawModal && (
          <div className="modal-backdrop" onClick={() => setShowWithdrawModal(false)}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
              <h3 className="modal-title">회원탈퇴</h3>
              <p style={{ fontSize: '0.88rem', color: '#5f6368', marginBottom: 16, lineHeight: 1.6 }}>
                탈퇴하면 계정 정보가 <strong>즉시 삭제</strong>되며 복구할 수 없습니다.
                {user?.isSocial
                  ? <><br />소셜 계정은 비밀번호 없이 탈퇴됩니다.</>
                  : <><br />비밀번호를 입력해 확인해주세요.</>
                }
              </p>
              <form onSubmit={handleWithdraw}>
                {!user?.isSocial && (
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
                  <button type="button" className="modal-cancel-btn" onClick={() => setShowWithdrawModal(false)}>
                    취소
                  </button>
                  <button
                    type="submit"
                    className="modal-submit-btn modal-submit-btn--danger"
                    disabled={withdrawLoading || (!user?.isSocial && !withdrawPassword)}
                  >
                    {withdrawLoading ? '처리 중...' : '탈퇴하기'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppContext.Provider>
  )
}
