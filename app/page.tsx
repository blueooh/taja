'use client'

import { useState, useEffect } from 'react'
import TypingGame from '@/components/TypingGame'
import ChatBox from '@/components/ChatBox'
import Scoreboard from '@/components/Scoreboard'

const NICKNAME_REGEX = /^[a-zA-Z0-9가-힣_]{1,20}$/
const STORAGE_KEY = 'taja:nickname'

export default function Home() {
  const [nickname, setNickname] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [scoreVersion, setScoreVersion] = useState(0)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && NICKNAME_REGEX.test(saved)) {
      setNickname(saved)
    }
  }, [])

  const isValidNickname = NICKNAME_REGEX.test(inputValue.trim())

  const handleNicknameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inputValue.trim()
    if (isValidNickname) {
      localStorage.setItem(STORAGE_KEY, trimmed)
      setNickname(trimmed)
    }
  }

  const handleChangeNickname = () => {
    localStorage.removeItem(STORAGE_KEY)
    setNickname(null)
    setInputValue('')
  }

  const handleScoreSubmitted = () => {
    setScoreVersion(v => v + 1)
  }

  if (!nickname) {
    return (
      <div className="nickname-screen">
        <div className="nickname-card">
          <h1>타자 게임</h1>
          <p>닉네임을 입력하고 게임을 시작하세요!</p>
          <form onSubmit={handleNicknameSubmit}>
            <input
              className="nickname-input"
              type="text"
              placeholder="닉네임 입력..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              maxLength={20}
              autoFocus
            />
            {inputValue.length > 0 && !isValidNickname && (
              <p style={{ color: '#dc3545', fontSize: '0.82rem', marginBottom: '8px' }}>
                한글, 영문, 숫자, 밑줄(_)만 사용 가능합니다.
              </p>
            )}
            <button
              className="nickname-submit-btn"
              type="submit"
              disabled={!isValidNickname}
            >
              게임 시작
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="main-layout">
      <TypingGame nickname={nickname} onScoreSubmitted={handleScoreSubmitted} onChangeNickname={handleChangeNickname} />
      <ChatBox nickname={nickname} />
      <Scoreboard nickname={nickname} scoreVersion={scoreVersion} />
    </div>
  )
}
