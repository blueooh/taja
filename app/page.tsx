'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import TypingGame from '@/components/TypingGame'
import AcidRain from '@/components/AcidRain'
import BattleGame from '@/components/BattleGame'
import GomokuGame from '@/components/GomokuGame'
import GostopGame from '@/components/GostopGame'
import Scoreboard from '@/components/Scoreboard'
import ChatBox from '@/components/ChatBox'
import type { AuthUser } from '@/lib/auth'
import { NICKNAME_REGEX } from '@/lib/auth'

type GameId = 'typing' | 'acidrain' | 'battle' | 'gomoku' | 'gostop'

const GAMES: { id: GameId; icon: string; name: string; desc: string }[] = [
  { id: 'typing',   icon: '⌨️', name: '스피드 타자', desc: '빠르고 정확하게 타이핑해 점수를 올리세요' },
  { id: 'acidrain', icon: '🌧️', name: '산성비',       desc: '떨어지는 단어를 빠르게 입력하세요'       },
  { id: 'battle',   icon: '⚔️', name: '1:1 배틀',    desc: '실시간으로 타자 속도를 겨루세요'          },
  { id: 'gomoku',   icon: '⚫', name: '오목',         desc: '5개의 돌을 먼저 놓는 사람이 승리'        },
  { id: 'gostop',   icon: '🎴', name: '고스톱',       desc: '화투로 즐기는 전통 고스톱 대결'          },
]

const GAME_LABELS: Record<GameId, string> = {
  typing: '스피드 타자',
  acidrain: '산성비',
  battle: '1:1 배틀',
  gomoku: '오목',
  gostop: '고스톱',
}

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)
  const [currentGame, setCurrentGame] = useState<GameId | null>(null)
  const [typingScoreVersion, setTypingScoreVersion] = useState(0)
  const [acidRainScoreVersion, setAcidRainScoreVersion] = useState(0)

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

  const goLogin = () => router.push('/login')
  const goHome = useCallback(() => setCurrentGame(null), [])

  if (user === undefined) return null

  return (
    <div className="app-shell">

      {/* ===== 헤더 ===== */}
      <header className="app-header">
        <div className="app-header-left">
          <button className="app-header-logo" onClick={goHome}>타짜</button>
          {currentGame && (
            <span className="game-view-title" style={{ borderLeft: '1px solid #e8eaed', paddingLeft: 12, fontSize: '0.95rem', color: '#5f6368', fontWeight: 500 }}>
              {GAME_LABELS[currentGame]}
            </span>
          )}
        </div>
        <div className="app-header-right">
          <button
            className={`app-header-chat-btn${chatOpen ? ' app-header-chat-btn--active' : ''}`}
            onClick={toggleChat}
          >
            💬 타짜톡
            {chatHasUnread && !chatOpen && <span className="app-header-chat-unread" />}
          </button>

          {user ? (
            <div className="top-bar-user-wrap" ref={dropdownRef}>
              <button className="top-bar-user" onClick={() => setDropdownOpen(v => !v)}>
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
                  <div style={{ height: 1, background: '#e8eaed', margin: '4px 0' }} />
                  <button className="top-bar-dropdown-item" onClick={handleLogout}>
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="top-bar-logout" onClick={goLogin}>로그인</button>
          )}
        </div>
      </header>

      {/* ===== 메인 영역 ===== */}
      <main className="app-main">

        {/* 홈: 게임 카드 그리드 */}
        {currentGame === null && (
          <div className="game-home">
            <h1 className="game-home-title">게임 선택</h1>
            <p className="game-home-subtitle">플레이할 게임을 고르세요</p>
            <div className="game-grid">
              {GAMES.map(game => (
                <button
                  key={game.id}
                  className="game-card-btn"
                  onClick={() => setCurrentGame(game.id)}
                >
                  <span className="game-card-icon">{game.icon}</span>
                  <span className="game-card-name">{game.name}</span>
                  <span className="game-card-desc">{game.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 게임 뷰 */}
        {currentGame !== null && (
          <div className="game-view">
            <div className="game-view-header">
              <button className="game-view-back" onClick={goHome}>← 홈</button>
              <span className="game-view-title">{GAME_LABELS[currentGame]}</span>
            </div>
            <div className="game-view-body">
              {currentGame === 'typing' && (
                <div className="game-with-scoreboard">
                  <TypingGame
                    user={user}
                    onScoreSubmitted={() => setTypingScoreVersion(v => v + 1)}
                    onLogout={handleLogout}
                    onNeedAuth={goLogin}
                  />
                  <Scoreboard
                    nickname={user?.nickname ?? ''}
                    scoreVersion={typingScoreVersion}
                    gameType="typing"
                  />
                </div>
              )}
              {currentGame === 'acidrain' && (
                <div className="game-with-scoreboard">
                  <AcidRain
                    user={user}
                    onScoreSubmitted={() => setAcidRainScoreVersion(v => v + 1)}
                    onLogout={handleLogout}
                    onNeedAuth={goLogin}
                  />
                  <Scoreboard
                    nickname={user?.nickname ?? ''}
                    scoreVersion={acidRainScoreVersion}
                    gameType="acidrain"
                  />
                </div>
              )}
              {currentGame === 'battle' && (
                <BattleGame user={user} onNeedAuth={goLogin} />
              )}
              {currentGame === 'gomoku' && (
                <GomokuGame user={user} onNeedAuth={goLogin} />
              )}
              {currentGame === 'gostop' && (
                <GostopGame user={user} onNeedAuth={goLogin} />
              )}
            </div>
          </div>
        )}
      </main>

      {/* ===== 채팅 드로어 ===== */}
      <div
        className={`chat-drawer-backdrop${chatOpen ? ' chat-drawer-backdrop--open' : ''}`}
        onClick={closeChat}
      />
      <aside className={`chat-drawer${chatOpen ? ' chat-drawer--open' : ''}`}>
        <ChatBox
          user={user}
          onNeedAuth={goLogin}
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
  )
}
