'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AuthUser } from '@/lib/auth'
import type { RealtimeChannel } from '@supabase/supabase-js'

type BattlePhase = 'room_list' | 'waiting' | 'countdown' | 'playing' | 'finished'

interface BattleRoom {
  roomId: string
  sentence: string
  opponentNickname: string
}

interface RoomItem {
  id: string
  hostNickname: string
  createdAt: number
}

interface Progress {
  value: number
  finished: boolean
  time: number
}

interface Props {
  user: AuthUser | null
  onNeedAuth: () => void
}

export default function BattleGame({ user, onNeedAuth }: Props) {
  const [phase, setPhase] = useState<BattlePhase>('room_list')
  const [rooms, setRooms] = useState<RoomItem[]>([])
  const [room, setRoom] = useState<BattleRoom | null>(null)
  const [input, setInput] = useState('')
  const [myProgress, setMyProgress] = useState<Progress>({ value: 0, finished: false, time: 0 })
  const [opponentProgress, setOpponentProgress] = useState<Progress>({ value: 0, finished: false, time: 0 })
  const [countdown, setCountdown] = useState(3)
  const [result, setResult] = useState<'win' | 'lose' | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [myRoomId, setMyRoomId] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const startTimeRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const phaseRef = useRef<BattlePhase>('room_list')
  const nicknameRef = useRef(user?.nickname ?? '')
  const opponentRef = useRef<Progress>({ value: 0, finished: false, time: 0 })
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { nicknameRef.current = user?.nickname ?? '' }, [user])
  useEffect(() => { phaseRef.current = phase }, [phase])

  const clearGameTimer = useCallback(() => {
    if (gameTimerRef.current) { clearInterval(gameTimerRef.current); gameTimerRef.current = null }
  }, [])

  const leaveChannel = useCallback(() => {
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
  }, [])

  useEffect(() => () => { leaveChannel(); clearGameTimer() }, [leaveChannel, clearGameTimer])

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/rooms?gameType=battle')
      const json = await res.json()
      if (json.success) setRooms(json.data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (phase !== 'room_list') {
      if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null }
      return
    }
    fetchRooms()
    pollTimerRef.current = setInterval(fetchRooms, 3000)
    return () => { if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null } }
  }, [phase, fetchRooms])

  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      setPhase('playing'); phaseRef.current = 'playing'
      startTimeRef.current = Date.now()
      setTimeout(() => inputRef.current?.focus(), 50)
      gameTimerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 500)
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  const finishGame = useCallback((myResult: 'win' | 'lose') => {
    clearGameTimer()
    setResult(myResult)
    setPhase('finished'); phaseRef.current = 'finished'
  }, [clearGameTimer])

  const startCountdown = useCallback((roomId: string, sentence: string, opponentNickname: string) => {
    setRoom({ roomId, sentence, opponentNickname })
    opponentRef.current = { value: 0, finished: false, time: 0 }
    setOpponentProgress({ value: 0, finished: false, time: 0 })
    setCountdown(3)
    setPhase('countdown'); phaseRef.current = 'countdown'
  }, [])

  const setupChannel = useCallback((
    roomId: string,
    role: 'player1' | 'player2',
    sentence: string,
    opponentNick?: string,
  ) => {
    leaveChannel()
    const channel = supabase.channel(`battle:${roomId}`, { config: { broadcast: { self: false } } })

    channel.on('broadcast', { event: 'battle_start' }, ({ payload }) => {
      if (role !== 'player1' || phaseRef.current !== 'waiting') return
      startCountdown(roomId, sentence, payload.nickname)
    })

    channel.on('broadcast', { event: 'progress' }, ({ payload }) => {
      if (payload.nickname === nicknameRef.current) return
      const p = { value: payload.progress, finished: payload.finished ?? false, time: payload.time ?? 0 }
      opponentRef.current = p
      setOpponentProgress(p)
    })

    channel.on('broadcast', { event: 'opponent_left' }, () => {
      const cur = phaseRef.current
      if (cur === 'playing' || cur === 'countdown' || cur === 'waiting') finishGame('win')
    })

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED' || role !== 'player2' || !opponentNick) return
      setTimeout(() => {
        channel.send({ type: 'broadcast', event: 'battle_start', payload: { nickname: nicknameRef.current } })
      }, 400)
      startCountdown(roomId, sentence, opponentNick)
    })

    channelRef.current = channel
  }, [leaveChannel, finishGame, startCountdown])

  const goToRoomList = useCallback(() => {
    leaveChannel(); clearGameTimer()
    setInput('')
    setMyProgress({ value: 0, finished: false, time: 0 })
    setOpponentProgress({ value: 0, finished: false, time: 0 })
    opponentRef.current = { value: 0, finished: false, time: 0 }
    setResult(null); setElapsed(0); setRoom(null); setMyRoomId(null)
    setPhase('room_list'); phaseRef.current = 'room_list'
  }, [leaveChannel, clearGameTimer])

  const handleCreateRoom = async () => {
    if (!user) { onNeedAuth(); return }
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameType: 'battle' }),
    })
    const json = await res.json()
    if (!json.success) return
    const { roomId, sentence } = json.data
    setMyRoomId(roomId)
    setPhase('waiting'); phaseRef.current = 'waiting'
    setupChannel(roomId, 'player1', sentence)
  }

  const handleJoinRoom = async (roomId: string) => {
    if (!user) { onNeedAuth(); return }
    const res = await fetch(`/api/rooms/${roomId}/join`, { method: 'POST' })
    const json = await res.json()
    if (!json.success) { fetchRooms(); return }
    setupChannel(roomId, 'player2', json.data.sentence, json.data.hostNickname)
  }

  const handleCancelRoom = async () => {
    if (myRoomId) {
      channelRef.current?.send({ type: 'broadcast', event: 'opponent_left', payload: {} })
      await fetch(`/api/rooms/${myRoomId}`, { method: 'DELETE' }).catch(() => {})
    }
    goToRoomList()
  }

  const handleSurrender = () => {
    channelRef.current?.send({ type: 'broadcast', event: 'opponent_left', payload: {} })
    leaveChannel(); finishGame('lose')
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
      type: 'broadcast', event: 'progress',
      payload: { nickname: nicknameRef.current, progress, finished, time },
    })
    if (finished) {
      const opp = opponentRef.current
      finishGame(!opp.finished || time < opp.time ? 'win' : 'lose')
    }
  }

  return (
    <div className="battle-game">
      {phase === 'room_list' && (
        <div className="room-list-screen">
          <div className="room-list-header">
            <button className="room-create-btn" onClick={handleCreateRoom}>＋ 방 만들기</button>
          </div>
          {rooms.length === 0 ? (
            <div className="room-list-empty">
              대기 중인 방이 없습니다.<br />방을 만들어 상대를 기다려보세요!
            </div>
          ) : (
            <div className="room-list">
              {rooms.map(r => (
                <div key={r.id} className="room-item">
                  <div className="room-item-info">
                    <span className="room-item-host">{r.hostNickname}의 방</span>
                    <span className="room-item-ago">{Math.floor((Date.now() - r.createdAt) / 60000)}분 전</span>
                  </div>
                  <button className="room-join-btn" onClick={() => handleJoinRoom(r.id)}>입장</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {phase === 'waiting' && (
        <div className="battle-matchmaking">
          <div className="battle-spinner" />
          <p className="battle-matchmaking-text">상대방을 기다리는 중...</p>
          <button onClick={handleCancelRoom} className="reset-button">취소</button>
        </div>
      )}

      {phase === 'countdown' && room && (
        <div className="battle-countdown">
          <div className="battle-vs">
            <span className="battle-vs-name">{nicknameRef.current}</span>
            <span className="battle-vs-label">VS</span>
            <span className="battle-vs-name">{room.opponentNickname}</span>
          </div>
          <div className="battle-countdown-number">{countdown === 0 ? 'GO!' : countdown}</div>
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
            <div className="battle-player-row" style={{ marginTop: 10 }}>
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
            ref={inputRef} type="text" value={input} onChange={handleInput}
            onPaste={e => e.preventDefault()} onCopy={e => e.preventDefault()} onCut={e => e.preventDefault()}
            placeholder="여기에 타이핑하세요..." className="typing-input"
          />
          <button onClick={handleSurrender} className="reset-button" style={{ marginTop: 4 }}>포기</button>
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
          <button onClick={goToRoomList} className="play-again-button">방 목록으로</button>
        </div>
      )}
    </div>
  )
}
