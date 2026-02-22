'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AuthUser } from '@/lib/auth'
import type { RealtimeChannel } from '@supabase/supabase-js'
import GameChat from '@/components/GameChat'

type GomokuPhase = 'room_list' | 'waiting' | 'countdown' | 'playing' | 'finished'
type StoneColor = 'black' | 'white'
type Board = (StoneColor | null)[]

const BOARD_SIZE = 15
const TOTAL_CELLS = BOARD_SIZE * BOARD_SIZE

const STAR_POINTS = new Set([
  2 * BOARD_SIZE + 2, 2 * BOARD_SIZE + 12,
  7 * BOARD_SIZE + 7,
  12 * BOARD_SIZE + 2, 12 * BOARD_SIZE + 12,
  2 * BOARD_SIZE + 7, 7 * BOARD_SIZE + 2,
  7 * BOARD_SIZE + 12, 12 * BOARD_SIZE + 7,
])

function checkWin(board: Board, row: number, col: number, color: StoneColor): number[] | null {
  const idx = (r: number, c: number) => r * BOARD_SIZE + c
  for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
    const cells: number[] = [idx(row, col)]
    for (let i = 1; i < 5; i++) {
      const r = row + dr * i, c = col + dc * i
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[idx(r,c)] !== color) break
      cells.push(idx(r, c))
    }
    for (let i = 1; i < 5; i++) {
      const r = row - dr * i, c = col - dc * i
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[idx(r,c)] !== color) break
      cells.push(idx(r, c))
    }
    if (cells.length >= 5) return cells
  }
  return null
}

function getCellClasses(index: number): string {
  const row = Math.floor(index / BOARD_SIZE), col = index % BOARD_SIZE
  const cls = ['gomoku-cell']
  if (row === 0) cls.push('gomoku-cell--top-edge')
  if (row === BOARD_SIZE - 1) cls.push('gomoku-cell--bottom-edge')
  if (col === 0) cls.push('gomoku-cell--left-edge')
  if (col === BOARD_SIZE - 1) cls.push('gomoku-cell--right-edge')
  return cls.join(' ')
}

interface RoomItem { id: string; hostNickname: string; createdAt: number }
interface Props { user: AuthUser | null; onNeedAuth: () => void }

export default function GomokuGame({ user, onNeedAuth }: Props) {
  const [phase, setPhase] = useState<GomokuPhase>('room_list')
  const [rooms, setRooms] = useState<RoomItem[]>([])
  const [board, setBoard] = useState<Board>(Array(TOTAL_CELLS).fill(null))
  const [currentTurn, setCurrentTurn] = useState<StoneColor>('black')
  const [myColor, setMyColor] = useState<StoneColor>('black')
  const [opponentNickname, setOpponentNickname] = useState('')
  const [countdown, setCountdown] = useState(3)
  const [elapsed, setElapsed] = useState(0)
  const [winner, setWinner] = useState<'me' | 'opponent' | null>(null)
  const [winningCells, setWinningCells] = useState<number[]>([])
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [myRoomId, setMyRoomId] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const phaseRef = useRef<GomokuPhase>('room_list')
  const boardRef = useRef<Board>(Array(TOTAL_CELLS).fill(null))
  const myColorRef = useRef<StoneColor>('black')
  const currentTurnRef = useRef<StoneColor>('black')
  const nicknameRef = useRef(user?.nickname ?? '')
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(0)

  useEffect(() => { nicknameRef.current = user?.nickname ?? '' }, [user])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { myColorRef.current = myColor }, [myColor])
  useEffect(() => { currentTurnRef.current = currentTurn }, [currentTurn])

  const clearGameTimer = useCallback(() => {
    if (gameTimerRef.current) { clearInterval(gameTimerRef.current); gameTimerRef.current = null }
  }, [])

  const leaveChannel = useCallback(() => {
    if (!channelRef.current) return
    const cur = phaseRef.current
    if (cur === 'playing' || cur === 'countdown') {
      channelRef.current.send({ type: 'broadcast', event: 'opponent_left', payload: {} })
    }
    supabase.removeChannel(channelRef.current)
    channelRef.current = null
  }, [])

  useEffect(() => () => { leaveChannel(); clearGameTimer() }, [leaveChannel, clearGameTimer])

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/rooms?gameType=gomoku')
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
      gameTimerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 500)
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  const finishGame = useCallback((result: 'me' | 'opponent', cells: number[] = []) => {
    clearGameTimer(); setWinner(result); setWinningCells(cells)
    setPhase('finished'); phaseRef.current = 'finished'
  }, [clearGameTimer])

  const processMove = useCallback((currentBoard: Board, row: number, col: number, color: StoneColor, isOpponent: boolean) => {
    const newBoard = [...currentBoard]
    newBoard[row * BOARD_SIZE + col] = color
    boardRef.current = newBoard
    setBoard(newBoard)
    const winCells = checkWin(newBoard, row, col, color)
    const nextTurn: StoneColor = color === 'black' ? 'white' : 'black'
    setCurrentTurn(nextTurn); currentTurnRef.current = nextTurn
    if (winCells) finishGame(isOpponent ? 'opponent' : 'me', winCells)
  }, [finishGame])

  const setupChannel = useCallback((rid: string, role: 'player1' | 'player2', opponentP2?: string) => {
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    const color: StoneColor = role === 'player1' ? 'black' : 'white'
    myColorRef.current = color; setMyColor(color)

    const channel = supabase.channel(`gomoku:${rid}`, { config: { broadcast: { self: false } } })

    channel.on('broadcast', { event: 'game_start' }, ({ payload }) => {
      if (role !== 'player1' || phaseRef.current !== 'waiting') return
      setOpponentNickname(payload.player2Nickname)
      setCountdown(3); setPhase('countdown'); phaseRef.current = 'countdown'
    })

    channel.on('broadcast', { event: 'move' }, ({ payload }) => {
      if (phaseRef.current !== 'playing') return
      const { row, col, color: moveColor } = payload as { row: number; col: number; color: StoneColor }
      if (typeof row !== 'number' || row < 0 || row >= BOARD_SIZE || typeof col !== 'number' || col < 0 || col >= BOARD_SIZE) return
      if (boardRef.current[row * BOARD_SIZE + col] !== null) return
      processMove(boardRef.current, row, col, moveColor, true)
    })

    channel.on('broadcast', { event: 'opponent_left' }, () => {
      const cur = phaseRef.current
      if (cur === 'playing' || cur === 'countdown' || cur === 'waiting') finishGame('me')
    })

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED' || role !== 'player2' || !opponentP2) return
      setTimeout(() => {
        channel.send({ type: 'broadcast', event: 'game_start', payload: { player1Nickname: opponentP2, player2Nickname: nicknameRef.current } })
      }, 400)
      setOpponentNickname(opponentP2)
      setCountdown(3); setPhase('countdown'); phaseRef.current = 'countdown'
    })

    channelRef.current = channel
  }, [finishGame, processMove])

  const goToRoomList = useCallback(() => {
    leaveChannel(); clearGameTimer()
    const emptyBoard: Board = Array(TOTAL_CELLS).fill(null)
    setBoard(emptyBoard); boardRef.current = emptyBoard
    setCurrentTurn('black'); currentTurnRef.current = 'black'
    setMyColor('black'); myColorRef.current = 'black'
    setWinner(null); setWinningCells([]); setElapsed(0)
    setOpponentNickname(''); setHoverIndex(null); setMyRoomId(null)
    setPhase('room_list'); phaseRef.current = 'room_list'
  }, [leaveChannel, clearGameTimer])

  const handleCreateRoom = async () => {
    if (!user) { onNeedAuth(); return }
    const res = await fetch('/api/rooms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameType: 'gomoku' }),
    })
    const json = await res.json()
    if (!json.success) return
    setMyRoomId(json.data.roomId)
    setPhase('waiting'); phaseRef.current = 'waiting'
    setupChannel(json.data.roomId, 'player1')
  }

  const handleJoinRoom = async (roomId: string) => {
    if (!user) { onNeedAuth(); return }
    const res = await fetch(`/api/rooms/${roomId}/join`, { method: 'POST' })
    const json = await res.json()
    if (!json.success) { fetchRooms(); return }
    setupChannel(roomId, 'player2', json.data.hostNickname)
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
    supabase.removeChannel(channelRef.current!); channelRef.current = null
    clearGameTimer(); finishGame('opponent')
  }

  const handleCellClick = (index: number) => {
    if (phaseRef.current !== 'playing') return
    if (myColorRef.current !== currentTurnRef.current) return
    if (boardRef.current[index] !== null) return
    const row = Math.floor(index / BOARD_SIZE), col = index % BOARD_SIZE
    processMove(boardRef.current, row, col, myColorRef.current, false)
    channelRef.current?.send({ type: 'broadcast', event: 'move', payload: { row, col, color: myColorRef.current } })
  }

  const isMyTurn = phase === 'playing' && currentTurn === myColor

  return (
    <div className="gomoku-game">
      {phase === 'room_list' && (
        <div className="room-list-screen">
          <div className="room-list-header">
            <button className="room-create-btn" onClick={handleCreateRoom}>＋ 방 만들기</button>
          </div>
          {rooms.length === 0 ? (
            <div className="room-list-empty">대기 중인 방이 없습니다.<br />방을 만들어 상대를 기다려보세요!</div>
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

      {phase === 'countdown' && (
        <div className="battle-countdown">
          <div className="battle-vs">
            <span className="battle-vs-name">{myColor === 'black' ? '⚫' : '⚪'} {nicknameRef.current}</span>
            <span className="battle-vs-label">VS</span>
            <span className="battle-vs-name">{myColor === 'black' ? '⚪' : '⚫'} {opponentNickname}</span>
          </div>
          <div className="battle-countdown-number">{countdown === 0 ? 'GO!' : countdown}</div>
        </div>
      )}

      {(phase === 'playing' || phase === 'finished') && (
        <div className="gomoku-layout">
          <div className="gomoku-info">
            <div className="gomoku-players">
              <div className={`gomoku-player${currentTurn === myColor && phase === 'playing' ? ' gomoku-player--active' : ''}`}>
                <span className="gomoku-stone-icon">{myColor === 'black' ? '⚫' : '⚪'}</span>
                <span>{nicknameRef.current} (나)</span>
              </div>
              <div className={`gomoku-player${currentTurn !== myColor && phase === 'playing' ? ' gomoku-player--active' : ''}`}>
                <span className="gomoku-stone-icon">{myColor === 'black' ? '⚪' : '⚫'}</span>
                <GameChat myNickname={user?.nickname ?? ''} opponentNickname={opponentNickname} />
              </div>
            </div>
            {phase === 'playing' && (
              <div className="gomoku-status">
                <span className={`gomoku-turn-indicator${isMyTurn ? ' gomoku-turn-indicator--my' : ''}`}>
                  {isMyTurn ? '내 차례' : '상대 차례'}
                </span>
                <span className="gomoku-elapsed">{elapsed}s</span>
              </div>
            )}
            {phase === 'finished' && (
              <div className="gomoku-result">
                <div className={`gomoku-result-text ${winner === 'me' ? 'gomoku-result-win' : 'gomoku-result-lose'}`}>
                  {winner === 'me' ? '🏆 승리!' : '😢 패배'}
                </div>
                <button onClick={goToRoomList} className="play-again-button">방 목록으로</button>
              </div>
            )}
            {phase === 'playing' && (
              <button onClick={handleSurrender} className="reset-button gomoku-surrender">포기</button>
            )}
          </div>
          <div className="gomoku-board" onMouseLeave={() => setHoverIndex(null)}>
            {board.map((stone, index) => {
              const isWinning = winningCells.includes(index)
              const isHover = hoverIndex === index && !stone && isMyTurn
              return (
                <div
                  key={index} className={getCellClasses(index)}
                  onClick={() => handleCellClick(index)}
                  onMouseEnter={() => { if (isMyTurn && !stone) setHoverIndex(index); else setHoverIndex(null) }}
                >
                  {STAR_POINTS.has(index) && !stone && <div className="gomoku-star" />}
                  {stone && <div className={`gomoku-stone gomoku-stone--${stone}${isWinning ? ' gomoku-stone--winning' : ''}`} />}
                  {isHover && <div className={`gomoku-stone-ghost gomoku-stone-ghost--${myColor}`} />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
