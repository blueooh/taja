'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AuthUser } from '@/lib/auth'
import type { RealtimeChannel } from '@supabase/supabase-js'

type BattlePhase = 'idle' | 'matchmaking' | 'countdown' | 'playing' | 'finished'

interface BattleRoom {
  roomId: string
  sentence: string
  opponentNickname: string
}

interface Progress {
  value: number      // 0–100
  finished: boolean
  time: number       // 완료 시간(초)
}

interface Props {
  user: AuthUser | null
  onNeedAuth: () => void
}

const MATCHMAKING_TIMEOUT = 60

export default function BattleGame({ user, onNeedAuth }: Props) {
  const [phase, setPhase] = useState<BattlePhase>('idle')
  const [room, setRoom] = useState<BattleRoom | null>(null)
  const [input, setInput] = useState('')
  const [myProgress, setMyProgress] = useState<Progress>({ value: 0, finished: false, time: 0 })
  const [opponentProgress, setOpponentProgress] = useState<Progress>({ value: 0, finished: false, time: 0 })
  const [countdown, setCountdown] = useState(3)
  const [result, setResult] = useState<'win' | 'lose' | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [waitSeconds, setWaitSeconds] = useState(0)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const startTimeRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const phaseRef = useRef<BattlePhase>('idle')
  const nicknameRef = useRef(user?.nickname ?? '')
  const opponentRef = useRef<Progress>({ value: 0, finished: false, time: 0 })
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const matchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { nicknameRef.current = user?.nickname ?? '' }, [user])
  useEffect(() => { phaseRef.current = phase }, [phase])

  const clearTimers = useCallback(() => {
    if (gameTimerRef.current) { clearInterval(gameTimerRef.current); gameTimerRef.current = null }
    if (matchTimerRef.current) { clearInterval(matchTimerRef.current); matchTimerRef.current = null }
  }, [])

  const leaveChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [])

  useEffect(() => () => { leaveChannel(); clearTimers() }, [leaveChannel, clearTimers])

  // 카운트다운
  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      setPhase('playing')
      phaseRef.current = 'playing'
      startTimeRef.current = Date.now()
      setTimeout(() => inputRef.current?.focus(), 50)
      gameTimerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 500)
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  const updateOpponent = useCallback((p: Progress) => {
    opponentRef.current = p
    setOpponentProgress(p)
  }, [])

  const finishGame = useCallback((myResult: 'win' | 'lose') => {
    clearTimers()
    setResult(myResult)
    setPhase('finished')
    phaseRef.current = 'finished'
  }, [clearTimers])

  const setupChannel = useCallback((
    roomId: string,
    role: 'player1' | 'player2',
    sentenceP2?: string,
    opponentP2?: string,
  ) => {
    leaveChannel()
    const channel = supabase.channel(`battle:${roomId}`, {
      config: { broadcast: { self: false } },
    })

    // Player1이 수신: 문장 + 상대 닉네임
    channel.on('broadcast', { event: 'battle_start' }, ({ payload }) => {
      if (role !== 'player1' || phaseRef.current !== 'matchmaking') return
      setRoom({ roomId, sentence: payload.sentence, opponentNickname: payload.nickname })
      opponentRef.current = { value: 0, finished: false, time: 0 }
      setOpponentProgress({ value: 0, finished: false, time: 0 })
      clearTimers()
      setCountdown(3)
      setPhase('countdown')
      phaseRef.current = 'countdown'
    })

    // 진행도 수신
    channel.on('broadcast', { event: 'progress' }, ({ payload }) => {
      if (payload.nickname === nicknameRef.current) return
      updateOpponent({ value: payload.progress, finished: payload.finished ?? false, time: payload.time ?? 0 })
    })

    // 상대방 포기/이탈
    channel.on('broadcast', { event: 'opponent_left' }, () => {
      const cur = phaseRef.current
      if (cur === 'playing' || cur === 'countdown' || cur === 'matchmaking') {
        finishGame('win')
      }
    })

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      if (role !== 'player2' || !sentenceP2 || !opponentP2) return

      // Player2가 구독 완료 후 약간 딜레이 후 시작 브로드캐스트
      setTimeout(() => {
        channel.send({
          type: 'broadcast',
          event: 'battle_start',
          payload: { sentence: sentenceP2, nickname: nicknameRef.current },
        })
      }, 400)

      setRoom({ roomId, sentence: sentenceP2, opponentNickname: opponentP2 })
      opponentRef.current = { value: 0, finished: false, time: 0 }
      setOpponentProgress({ value: 0, finished: false, time: 0 })
      clearTimers()
      setCountdown(3)
      setPhase('countdown')
      phaseRef.current = 'countdown'
    })

    channelRef.current = channel
  }, [leaveChannel, clearTimers, updateOpponent, finishGame])

  const resetState = useCallback(() => {
    setInput('')
    setMyProgress({ value: 0, finished: false, time: 0 })
    setOpponentProgress({ value: 0, finished: false, time: 0 })
    opponentRef.current = { value: 0, finished: false, time: 0 }
    setResult(null)
    setElapsed(0)
    setWaitSeconds(0)
    setRoom(null)
  }, [])

  const handleCancel = useCallback(async () => {
    clearTimers()
    leaveChannel()
    setPhase('idle')
    phaseRef.current = 'idle'
    await fetch('/api/battle/queue', { method: 'DELETE' }).catch(() => {})
  }, [clearTimers, leaveChannel])

  const startMatchmaking = async () => {
    if (!user) { onNeedAuth(); return }
    resetState()
    setPhase('matchmaking')
    phaseRef.current = 'matchmaking'

    let secs = 0
    matchTimerRef.current = setInterval(() => {
      secs++
      setWaitSeconds(secs)
      if (secs >= MATCHMAKING_TIMEOUT) handleCancel()
    }, 1000)

    try {
      const res = await fetch('/api/battle/queue', { method: 'POST' })
      const json = await res.json()
      if (!json.success) { handleCancel(); return }

      if (json.status === 'matched') {
        setupChannel(json.roomId, 'player2', json.sentence, json.opponent)
      } else {
        setupChannel(json.roomId, 'player1')
      }
    } catch {
      handleCancel()
    }
  }

  const handleSurrender = () => {
    channelRef.current?.send({ type: 'broadcast', event: 'opponent_left', payload: {} })
    leaveChannel()
    finishGame('lose')
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!room || phaseRef.current !== 'playing') return
    const value = e.target.value
    setInput(value)

    const progress = Math.min(100, Math.round((value.length / room.sentence.length) * 100))
    const finished = value === room.sentence
    const time = finished ? (Date.now() - startTimeRef.current) / 1000 : 0

    setMyProgress({ value: progress, finished, time })
    channelRef.current?.send({
      type: 'broadcast',
      event: 'progress',
      payload: { nickname: nicknameRef.current, progress, finished, time },
    })

    if (finished) {
      const opp = opponentRef.current
      const myResult = !opp.finished || time < opp.time ? 'win' : 'lose'
      finishGame(myResult)
    }
  }

  // ===== RENDER =====
  return (
    <div className="battle-game">
      {phase === 'idle' && (
        <div className="start-screen">
          {!user ? (
            <>
              <p style={{ color: '#888' }}>게임을 시작하려면 로그인이 필요합니다.</p>
              <button onClick={onNeedAuth} className="start-button">로그인하고 시작</button>
            </>
          ) : (
            <>
              <p>같은 문장을 실시간으로 대결!<br />상대방보다 빠르게 입력하세요.</p>
              <button onClick={startMatchmaking} className="start-button">대결 시작</button>
            </>
          )}
        </div>
      )}

      {phase === 'matchmaking' && (
        <div className="battle-matchmaking">
          <div className="battle-spinner" />
          <p className="battle-matchmaking-text">상대방을 찾는 중... {waitSeconds}s</p>
          <button onClick={handleCancel} className="reset-button">취소</button>
        </div>
      )}

      {phase === 'countdown' && room && (
        <div className="battle-countdown">
          <div className="battle-vs">
            <span className="battle-vs-name">{nicknameRef.current}</span>
            <span className="battle-vs-label">VS</span>
            <span className="battle-vs-name">{room.opponentNickname}</span>
          </div>
          <div className="battle-countdown-number">
            {countdown === 0 ? 'GO!' : countdown}
          </div>
        </div>
      )}

      {phase === 'playing' && room && (
        <div className="battle-playing">
          <div className="battle-progress-wrap">
            <div className="battle-player-row">
              <span className="battle-player-name">{nicknameRef.current} (나)</span>
              <span className="battle-player-time">{elapsed}s</span>
            </div>
            <div className="battle-bar-bg">
              <div className="battle-bar-fill battle-bar-me" style={{ width: `${myProgress.value}%` }} />
            </div>
            <div className="battle-player-row" style={{ marginTop: '10px' }}>
              <span className="battle-player-name">{room.opponentNickname}</span>
              {opponentProgress.finished && (
                <span className="battle-player-time">{opponentProgress.time.toFixed(1)}s ✓</span>
              )}
            </div>
            <div className="battle-bar-bg">
              <div className="battle-bar-fill battle-bar-opp" style={{ width: `${opponentProgress.value}%` }} />
            </div>
          </div>

          <div className="sentence-display">
            <p className="sentence-text">{room.sentence}</p>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInput}
            onPaste={e => e.preventDefault()}
            onCopy={e => e.preventDefault()}
            onCut={e => e.preventDefault()}
            placeholder="여기에 타이핑하세요..."
            className="typing-input"
          />
          <button onClick={handleSurrender} className="reset-button" style={{ marginTop: '4px' }}>포기</button>
        </div>
      )}

      {phase === 'finished' && (
        <div className="result-screen">
          <h2 className={result === 'win' ? 'battle-result-win' : 'battle-result-lose'}>
            {result === 'win' ? '🏆 승리!' : '😢 패배'}
          </h2>
          {room && (
            <div className="result-stats">
              <div className="result-item">
                <span>내 기록</span>
                <span>{myProgress.finished ? `${myProgress.time.toFixed(1)}초` : '-'}</span>
              </div>
              <div className="result-item">
                <span>{room.opponentNickname}</span>
                <span>{opponentProgress.finished ? `${opponentProgress.time.toFixed(1)}초` : '-'}</span>
              </div>
            </div>
          )}
          <button onClick={startMatchmaking} className="play-again-button">다시 대결</button>
        </div>
      )}
    </div>
  )
}
