'use client'

import { useState, useEffect, useRef, useReducer } from 'react'
import type { AuthUser } from '@/lib/auth'

interface FallingWord {
  id: number
  text: string
  x: number   // % from left
  y: number   // px from top
  speed: number  // px/sec
}

interface Props {
  user: AuthUser | null
  onScoreSubmitted: () => void
  onLogout: () => void
  onNeedAuth: () => void
}

type GamePhase = 'idle' | 'playing' | 'gameover'
type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'

const WORD_POOL = [
  '사랑', '행복', '하늘', '바다', '산', '꽃', '나무', '물', '불', '바람',
  '구름', '달', '별', '해', '땅', '집', '밥', '강', '새', '숲',
  '빛', '눈', '비', '눈물', '웃음', '꿈', '희망', '용기', '믿음', '지혜',
  '봄', '여름', '가을', '겨울', '아침', '저녁', '밤', '낮',
  '학교', '친구', '가족', '엄마', '아빠', '음악', '그림',
  '사과', '포도', '딸기', '수박', '복숭아',
  '고양이', '강아지', '토끼', '여우', '호랑이',
  '노래', '춤', '운동', '공부', '여행',
  '타자', '한글', '컴퓨터', '인터넷',
  '번개', '천둥', '태풍', '폭풍', '소나기',
  '달리기', '수영', '야구', '축구', '농구',
  '피자', '김밥', '라면', '비빔밥', '삼겹살',
  '사자', '코끼리', '기린', '원숭이', '펭귄',
  '기타', '피아노', '바이올린', '드럼',
  '모자', '양말', '신발', '가방', '시계',
  '하나', '둘', '셋', '넷', '다섯',
  '빠르다', '느리다', '높다', '낮다', '크다', '작다',
  '파랗다', '빨갛다', '노랗다', '초록', '보라',
]

const GAME_HEIGHT = 280
const GROUND_THRESHOLD = GAME_HEIGHT - 8
const BASE_SPEED = 55
const SPEED_PER_LEVEL = 18
const LEVEL_UP_EVERY = 10

const AcidRain: React.FC<Props> = ({ user, onScoreSubmitted, onLogout, onNeedAuth }) => {
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')
  const [, forceRender] = useReducer(n => n + 1, 0)
  const [input, setInput] = useState('')

  const gs = useRef({
    words: [] as FallingWord[],
    lives: 3,
    score: 0,
    level: 1,
    wordsDestroyed: 0,
    missedWords: 0,
    charsTyped: 0,
    spawnTimer: 0,
    lastTime: 0,
    running: false,
    wordId: 0,
    startTime: 0,
    animFrame: 0,
    finalWpm: 0,
    finalAccuracy: 0,
    finalScore: 0,
    finalElapsed: 0,
  })

  const inputRef = useRef<HTMLInputElement>(null)
  const userRef = useRef(user)
  const cbRef = useRef(onScoreSubmitted)

  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { cbRef.current = onScoreSubmitted }, [onScoreSubmitted])

  useEffect(() => {
    return () => {
      gs.current.running = false
      cancelAnimationFrame(gs.current.animFrame)
    }
  }, [])

  function triggerGameOver() {
    const state = gs.current
    state.running = false
    cancelAnimationFrame(state.animFrame)
    state.words = []

    const elapsed = Math.max(0.5, (Date.now() - state.startTime) / 1000)
    const total = state.wordsDestroyed + state.missedWords
    const accuracy = total > 0 ? Math.round((state.wordsDestroyed / total) * 100) : 0

    state.finalWpm = Math.max(1, state.score)
    state.finalAccuracy = accuracy
    state.finalScore = state.score
    state.finalElapsed = elapsed

    setPhase('gameover')
    setInput('')
    forceRender()

    setSubmitStatus('submitting')
    fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: userRef.current?.nickname ?? '',
        wpm: Math.max(1, state.score),
        accuracy: Math.max(1, accuracy),
        time: elapsed,
        gameType: 'acidrain',
      }),
    })
      .then(r => r.json())
      .then(json => {
        setSubmitStatus(json.success ? 'success' : 'error')
        if (json.success) cbRef.current()
      })
      .catch(() => setSubmitStatus('error'))
  }

  function runLoop(timestamp: number) {
    const state = gs.current
    if (!state.running) return

    const dt = state.lastTime
      ? Math.min((timestamp - state.lastTime) / 1000, 0.05)
      : 0
    state.lastTime = timestamp

    // Spawn words
    state.spawnTimer += dt
    const spawnInterval = Math.max(0.3, 2.0 - (state.level - 1) * 0.20)
    if (state.spawnTimer >= spawnInterval) {
      state.spawnTimer = 0
      const text = WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)]
      const x = 2 + Math.random() * 80
      const speed = BASE_SPEED + (state.level - 1) * SPEED_PER_LEVEL + Math.random() * 15
      state.words = [...state.words, { id: state.wordId++, text, x, y: -32, speed }]
    }

    // Update positions & check ground
    let livesLost = 0
    const alive: FallingWord[] = []
    for (const w of state.words) {
      const newY = w.y + w.speed * dt
      if (newY >= GROUND_THRESHOLD) {
        livesLost++
        state.missedWords++
      } else {
        alive.push({ ...w, y: newY })
      }
    }
    state.words = alive

    if (livesLost > 0) {
      state.lives = Math.max(0, state.lives - livesLost)
      if (state.lives <= 0) {
        triggerGameOver()
        return
      }
    }

    forceRender()
    state.animFrame = requestAnimationFrame(runLoop)
  }

  function startGame() {
    if (!userRef.current) { onNeedAuth(); return }
    cancelAnimationFrame(gs.current.animFrame)
    const state = gs.current
    state.words = []
    state.lives = 3
    state.score = 0
    state.level = 1
    state.wordsDestroyed = 0
    state.missedWords = 0
    state.charsTyped = 0
    state.spawnTimer = 0
    state.lastTime = 0
    state.running = true
    state.wordId = 0
    state.startTime = Date.now()
    state.animFrame = 0

    setInput('')
    setSubmitStatus('idle')
    setPhase('playing')
    forceRender()

    state.animFrame = requestAnimationFrame(runLoop)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setInput(value)

    const trimmed = value.trim()
    if (!trimmed) return

    const state = gs.current
    const matchIdx = state.words.findIndex(w => w.text === trimmed)
    if (matchIdx !== -1) {
      const destroyed = state.words[matchIdx]
      state.words = state.words.filter((_, i) => i !== matchIdx)
      state.charsTyped += destroyed.text.length
      state.wordsDestroyed += 1
      state.score += destroyed.text.length * 10 * state.level

      const newLevel = Math.floor(state.wordsDestroyed / LEVEL_UP_EVERY) + 1
      if (newLevel > state.level) state.level = newLevel

      forceRender()
      setInput('')
    }
  }

  const state = gs.current

  return (
    <div className="acid-rain-game">
      <h2>산성비</h2>

      {phase === 'idle' && (
        <div className="start-screen">
          {!user ? (
            <>
              <p style={{ color: '#888' }}>게임을 시작하려면 로그인이 필요합니다.</p>
              <button onClick={onNeedAuth} className="start-button">로그인하고 시작</button>
            </>
          ) : (
            <>
              <p>하늘에서 단어가 떨어집니다.<br />땅에 닿기 전에 단어를 입력하세요!</p>
              <div style={{ marginBottom: '16px', fontSize: '0.85rem', color: '#888' }}>
                ❤️ 생명 3개 · {LEVEL_UP_EVERY}단어마다 레벨업
              </div>
              <button onClick={startGame} className="start-button">게임 시작</button>
            </>
          )}
        </div>
      )}

      {phase === 'playing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="acid-rain-stats">
            <span>점수 <strong>{state.score}</strong></span>
            <span>레벨 <strong>{state.level}</strong></span>
            <span>
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i}>{i < state.lives ? '❤️' : '🖤'}</span>
              ))}
            </span>
          </div>

          <div className="acid-rain-area">
            {state.words.map(w => {
              const isHighlight = input.trim().length > 0 && w.text.startsWith(input.trim())
              return (
                <span
                  key={w.id}
                  className={`falling-word${isHighlight ? ' falling-word--highlight' : ''}`}
                  style={{ left: `${w.x}%`, top: `${w.y}px` }}
                >
                  {w.text}
                </span>
              )
            })}
            <div className="acid-rain-ground" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInput}
            onPaste={e => e.preventDefault()}
            placeholder="단어 입력..."
            className="typing-input"
            autoComplete="off"
            spellCheck={false}
            style={{ marginBottom: 0, flexShrink: 0 }}
          />
        </div>
      )}

      {phase === 'gameover' && (
        <div className="result-screen">
          <h2>게임 오버!</h2>
          <div className="result-stats">
            <div className="result-item">
              <span>점수</span>
              <span>{state.finalWpm}</span>
            </div>
            <div className="result-item">
              <span>단어</span>
              <span>{state.wordsDestroyed}</span>
            </div>
            <div className="result-item">
              <span>정확도</span>
              <span>{state.finalAccuracy}%</span>
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

export default AcidRain
