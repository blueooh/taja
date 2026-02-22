'use client'

import { useState, useRef } from 'react'
import { type Theme, THEME_LABELS, SENTENCES_MAP } from '@/lib/sentences'
import type { AuthUser } from '@/lib/auth'

interface GameResult {
  time: number
  accuracy: number
  wpm: number
  date: Date
}

interface Props {
  user: AuthUser | null
  onScoreSubmitted: () => void
  onLogout: () => void
  onNeedAuth: () => void
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'

const TypingGame: React.FC<Props> = ({ user, onScoreSubmitted, onLogout, onNeedAuth }) => {
  const [selectedTheme, setSelectedTheme] = useState<Theme>('park')
  const [currentSentence, setCurrentSentence] = useState('')
  const [userInput, setUserInput] = useState('')
  const [isGameStarted, setIsGameStarted] = useState(false)
  const [isGameFinished, setIsGameFinished] = useState(false)
  const [startTime, setStartTime] = useState(0)
  const [results, setResults] = useState<GameResult[]>([])
  const [errors, setErrors] = useState(0)
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  const startGame = () => {
    if (!user) { onNeedAuth(); return }
    const sentences = SENTENCES_MAP[selectedTheme]
    const randomIndex = Math.floor(Math.random() * sentences.length)
    setCurrentSentence(sentences[randomIndex])
    setUserInput('')
    setIsGameStarted(true)
    setIsGameFinished(false)
    setStartTime(Date.now())
    setErrors(0)
    setSubmitStatus('idle')
    inputRef.current?.focus()
  }

  const calculateAccuracy = (input: string, sentence: string): number => {
    if (sentence.length === 0) return 100
    const correctChars = sentence.split('').filter((char, i) => input[i] === char).length
    return Math.round((correctChars / sentence.length) * 100)
  }

  const calculateWPM = (timeInSeconds: number): number => {
    const words = currentSentence.split(' ').length
    const minutes = timeInSeconds / 60
    return Math.round(words / minutes)
  }

  const submitScore = async (wpm: number, accuracy: number, timeInSeconds: number) => {
    if (!user) return
    setSubmitStatus('submitting')
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: user.nickname, wpm, accuracy, time: timeInSeconds, gameType: 'typing' }),
      })
      const json = await res.json()
      if (json.success) {
        setSubmitStatus('success')
        onScoreSubmitted()
      } else {
        setSubmitStatus('error')
      }
    } catch {
      setSubmitStatus('error')
    }
  }

  const finishGame = (input: string) => {
    const now = Date.now()
    setIsGameFinished(true)
    setIsGameStarted(false)

    const timeInSeconds = (now - startTime) / 1000
    const accuracy = calculateAccuracy(input, currentSentence)
    const wpm = calculateWPM(timeInSeconds)

    setResults(prev => [{ time: timeInSeconds, accuracy, wpm, date: new Date() }, ...prev])
    submitScore(wpm, accuracy, timeInSeconds)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setUserInput(value)

    let errorCount = 0
    for (let i = 0; i < value.length; i++) {
      if (value[i] !== currentSentence[i]) errorCount++
    }
    setErrors(errorCount)

    if (value === currentSentence) finishGame(value)
  }

  const resetGame = () => {
    setIsGameStarted(false)
    setIsGameFinished(false)
    setUserInput('')
    setStartTime(0)
    setErrors(0)
    setSubmitStatus('idle')
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const elapsedSeconds = isGameStarted ? (Date.now() - startTime) / 1000 : 0
  const lastResult = results[0]

  return (
    <div className="typing-game">
      {!isGameStarted && !isGameFinished && (
        <div className="start-screen">
          {!user ? (
            <>
              <p style={{ color: '#888' }}>게임을 시작하려면 로그인이 필요합니다.</p>
              <button onClick={onNeedAuth} className="start-button">로그인하고 시작</button>
            </>
          ) : (
            <>
              <div className="theme-selector">
                {(Object.keys(THEME_LABELS) as Theme[]).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => setSelectedTheme(theme)}
                    className={`theme-btn${selectedTheme === theme ? ' active' : ''}`}
                  >
                    {THEME_LABELS[theme]}
                  </button>
                ))}
              </div>
              <p>아래 버튼을 클릭하여 게임을 시작하세요!</p>
              <button onClick={startGame} className="start-button">게임 시작</button>
            </>
          )}
        </div>
      )}

      {isGameStarted && (
        <div className="game-screen">
          <div className="stats">
            <div className="stat-item">⏱ {formatTime(elapsedSeconds)}</div>
            <div className="stat-item">오류 {errors}</div>
            <div className="stat-item">진행 {Math.round((userInput.length / currentSentence.length) * 100)}%</div>
          </div>

          <div className="sentence-display">
            <p className="sentence-text">{currentSentence}</p>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={handleInputChange}
            onPaste={e => e.preventDefault()}
            onCopy={e => e.preventDefault()}
            onCut={e => e.preventDefault()}
            placeholder="여기에 타이핑하세요..."
            className="typing-input"
            disabled={isGameFinished}
          />

          <div className="progress">
            <div
              className="progress-bar"
              style={{ width: `${(userInput.length / currentSentence.length) * 100}%` }}
            />
          </div>

          <button onClick={resetGame} className="reset-button">다시 시작</button>
        </div>
      )}

      {isGameFinished && lastResult && (
        <div className="result-screen">
          <h2>게임 완료!</h2>
          <div className="result-stats">
            <div className="result-item">
              <span>소요 시간</span>
              <span>{formatTime(lastResult.time)}</span>
            </div>
            <div className="result-item">
              <span>정확도</span>
              <span>{lastResult.accuracy}%</span>
            </div>
            <div className="result-item">
              <span>WPM</span>
              <span>{lastResult.wpm}</span>
            </div>
          </div>

          {submitStatus === 'submitting' && (
            <p className="submit-status submitting">점수 저장 중...</p>
          )}
          {submitStatus === 'success' && (
            <p className="submit-status success">✓ 스코어보드에 등록되었습니다!</p>
          )}
          {submitStatus === 'error' && (
            <p className="submit-status error">점수 저장 실패. 다시 시도해주세요.</p>
          )}

          <button onClick={startGame} className="play-again-button">다시 플레이</button>
        </div>
      )}
    </div>
  )
}

export default TypingGame
