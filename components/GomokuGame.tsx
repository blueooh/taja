'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AuthUser } from '@/lib/auth'
import type { RealtimeChannel } from '@supabase/supabase-js'

type GomokuPhase = 'idle' | 'matchmaking' | 'countdown' | 'playing' | 'finished'
type StoneColor = 'black' | 'white'
type Board = (StoneColor | null)[]

const BOARD_SIZE = 15
const TOTAL_CELLS = BOARD_SIZE * BOARD_SIZE
const MATCHMAKING_TIMEOUT = 60

// 별점(화점) 위치
const STAR_POINTS = new Set([
  2 * BOARD_SIZE + 2,
  2 * BOARD_SIZE + 12,
  7 * BOARD_SIZE + 7,  // 천원
  12 * BOARD_SIZE + 2,
  12 * BOARD_SIZE + 12,
  2 * BOARD_SIZE + 7,
  7 * BOARD_SIZE + 2,
  7 * BOARD_SIZE + 12,
  12 * BOARD_SIZE + 7,
])

function checkWin(board: Board, row: number, col: number, color: StoneColor): number[] | null {
  const idx = (r: number, c: number) => r * BOARD_SIZE + c
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]

  for (const [dr, dc] of directions) {
    const cells: number[] = [idx(row, col)]

    for (let i = 1; i < 5; i++) {
      const r = row + dr * i
      const c = col + dc * i
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break
      if (board[idx(r, c)] !== color) break
      cells.push(idx(r, c))
    }

    for (let i = 1; i < 5; i++) {
      const r = row - dr * i
      const c = col - dc * i
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break
      if (board[idx(r, c)] !== color) break
      cells.push(idx(r, c))
    }

    if (cells.length >= 5) return cells
  }

  return null
}

function applyMove(board: Board, row: number, col: number, color: StoneColor): Board {
  const next = [...board]
  next[row * BOARD_SIZE + col] = color
  return next
}

function getCellClasses(index: number): string {
  const row = Math.floor(index / BOARD_SIZE)
  const col = index % BOARD_SIZE
  const classes: string[] = ['gomoku-cell']

  if (row === 0) classes.push('gomoku-cell--top-edge')
  if (row === BOARD_SIZE - 1) classes.push('gomoku-cell--bottom-edge')
  if (col === 0) classes.push('gomoku-cell--left-edge')
  if (col === BOARD_SIZE - 1) classes.push('gomoku-cell--right-edge')

  return classes.join(' ')
}

interface Props {
  user: AuthUser | null
  onNeedAuth: () => void
}

export default function GomokuGame({ user, onNeedAuth }: Props) {
  const [phase, setPhase] = useState<GomokuPhase>('idle')
  const [board, setBoard] = useState<Board>(Array(TOTAL_CELLS).fill(null))
  const [currentTurn, setCurrentTurn] = useState<StoneColor>('black')
  const [myColor, setMyColor] = useState<StoneColor>('black')
  const [opponentNickname, setOpponentNickname] = useState('')
  const [countdown, setCountdown] = useState(3)
  const [elapsed, setElapsed] = useState(0)
  const [waitSeconds, setWaitSeconds] = useState(0)
  const [winner, setWinner] = useState<'me' | 'opponent' | null>(null)
  const [winningCells, setWinningCells] = useState<number[]>([])
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const phaseRef = useRef<GomokuPhase>('idle')
  const boardRef = useRef<Board>(Array(TOTAL_CELLS).fill(null))
  const myColorRef = useRef<StoneColor>('black')
  const currentTurnRef = useRef<StoneColor>('black')
  const nicknameRef = useRef(user?.nickname ?? '')
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const matchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(0)

  useEffect(() => { nicknameRef.current = user?.nickname ?? '' }, [user])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { myColorRef.current = myColor }, [myColor])
  useEffect(() => { currentTurnRef.current = currentTurn }, [currentTurn])

  const clearTimers = useCallback(() => {
    if (gameTimerRef.current) { clearInterval(gameTimerRef.current); gameTimerRef.current = null }
    if (matchTimerRef.current) { clearInterval(matchTimerRef.current); matchTimerRef.current = null }
  }, [])

  // 이탈 시 상대방에게 알린 후 채널 해제
  const leaveChannel = useCallback(() => {
    if (!channelRef.current) return
    const cur = phaseRef.current
    if (cur === 'playing' || cur === 'countdown') {
      channelRef.current.send({ type: 'broadcast', event: 'opponent_left', payload: {} })
    }
    supabase.removeChannel(channelRef.current)
    channelRef.current = null
  }, [])

  useEffect(() => () => { leaveChannel(); clearTimers() }, [leaveChannel, clearTimers])

  // 카운트다운
  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      setPhase('playing')
      phaseRef.current = 'playing'
      startTimeRef.current = Date.now()
      gameTimerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 500)
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  const finishGame = useCallback((result: 'me' | 'opponent', cells: number[] = []) => {
    clearTimers()
    setWinner(result)
    setWinningCells(cells)
    setPhase('finished')
    phaseRef.current = 'finished'
  }, [clearTimers])

  // 수를 보드에 적용하고 턴/승리 상태 업데이트 (순수하게 상태만 변경)
  const processMove = useCallback((
    currentBoard: Board,
    row: number,
    col: number,
    color: StoneColor,
    isOpponent: boolean,
  ) => {
    const newBoard = applyMove(currentBoard, row, col, color)
    boardRef.current = newBoard
    setBoard(newBoard)

    const winCells = checkWin(newBoard, row, col, color)
    const nextTurn: StoneColor = color === 'black' ? 'white' : 'black'
    setCurrentTurn(nextTurn)
    currentTurnRef.current = nextTurn

    if (winCells) {
      finishGame(isOpponent ? 'opponent' : 'me', winCells)
    }
  }, [finishGame])

  const setupChannel = useCallback((
    rid: string,
    role: 'player1' | 'player2',
    opponentP2?: string,
  ) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    const color: StoneColor = role === 'player1' ? 'black' : 'white'
    myColorRef.current = color
    setMyColor(color)

    const channel = supabase.channel(`gomoku:${rid}`, {
      config: { broadcast: { self: false } },
    })

    // Player1이 수신: 게임 시작 신호
    channel.on('broadcast', { event: 'game_start' }, ({ payload }) => {
      if (role !== 'player1' || phaseRef.current !== 'matchmaking') return
      setOpponentNickname(payload.player2Nickname)
      clearTimers()
      setCountdown(3)
      setPhase('countdown')
      phaseRef.current = 'countdown'
    })

    // 수 수신 - 입력값 검증 후 적용
    channel.on('broadcast', { event: 'move' }, ({ payload }) => {
      if (phaseRef.current !== 'playing') return
      const { row, col, color: moveColor } = payload as { row: number; col: number; color: StoneColor }

      if (
        typeof row !== 'number' || row < 0 || row >= BOARD_SIZE ||
        typeof col !== 'number' || col < 0 || col >= BOARD_SIZE ||
        (moveColor !== 'black' && moveColor !== 'white')
      ) return

      const index = row * BOARD_SIZE + col
      if (boardRef.current[index] !== null) return

      processMove(boardRef.current, row, col, moveColor, true)
    })

    // 상대방 이탈
    channel.on('broadcast', { event: 'opponent_left' }, () => {
      const cur = phaseRef.current
      if (cur === 'playing' || cur === 'countdown' || cur === 'matchmaking') {
        finishGame('me')
      }
    })

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      if (role !== 'player2' || !opponentP2) return

      setTimeout(() => {
        channel.send({
          type: 'broadcast',
          event: 'game_start',
          payload: {
            player1Nickname: opponentP2,
            player2Nickname: nicknameRef.current,
          },
        })
      }, 400)

      setOpponentNickname(opponentP2)
      clearTimers()
      setCountdown(3)
      setPhase('countdown')
      phaseRef.current = 'countdown'
    })

    channelRef.current = channel
  }, [clearTimers, finishGame, processMove])

  const resetState = useCallback(() => {
    const emptyBoard: Board = Array(TOTAL_CELLS).fill(null)
    setBoard(emptyBoard)
    boardRef.current = emptyBoard
    setCurrentTurn('black')
    currentTurnRef.current = 'black'
    setMyColor('black')
    myColorRef.current = 'black'
    setWinner(null)
    setWinningCells([])
    setElapsed(0)
    setWaitSeconds(0)
    setOpponentNickname('')
    setHoverIndex(null)
  }, [])

  const handleCancel = useCallback(async () => {
    clearTimers()
    leaveChannel()
    setPhase('idle')
    phaseRef.current = 'idle'
    await fetch('/api/gomoku/queue', { method: 'DELETE' }).catch(() => {})
  }, [clearTimers, leaveChannel])

  const startMatchmaking = async () => {
    if (!user) { onNeedAuth(); return }
    clearTimers()
    leaveChannel()
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
      const res = await fetch('/api/gomoku/queue', { method: 'POST' })
      const json = await res.json()
      if (!json.success) { handleCancel(); return }

      if (json.status === 'matched') {
        setupChannel(json.roomId, 'player2', json.opponent)
      } else {
        setupChannel(json.roomId, 'player1')
      }
    } catch {
      handleCancel()
    }
  }

  const handleSurrender = () => {
    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'opponent_left', payload: {} })
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    clearTimers()
    finishGame('opponent')
  }

  const handleCellClick = (index: number) => {
    if (phaseRef.current !== 'playing') return
    if (myColorRef.current !== currentTurnRef.current) return
    if (boardRef.current[index] !== null) return

    const row = Math.floor(index / BOARD_SIZE)
    const col = index % BOARD_SIZE
    const color = myColorRef.current

    processMove(boardRef.current, row, col, color, false)

    channelRef.current?.send({
      type: 'broadcast',
      event: 'move',
      payload: { row, col, color },
    })
  }

  const isMyTurn = phase === 'playing' && currentTurn === myColor

  // ===== RENDER =====
  return (
    <div className="gomoku-game">
      {phase === 'idle' && (
        <div className="start-screen">
          {!user ? (
            <>
              <p style={{ color: '#888' }}>게임을 시작하려면 로그인이 필요합니다.</p>
              <button onClick={onNeedAuth} className="start-button">로그인하고 시작</button>
            </>
          ) : (
            <>
              <p>15×15 오목 대결!<br />상대방보다 먼저 5개를 연속으로 놓으세요.</p>
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

      {phase === 'countdown' && (
        <div className="battle-countdown">
          <div className="battle-vs">
            <span className="battle-vs-name">
              {myColor === 'black' ? '⚫' : '⚪'} {nicknameRef.current}
            </span>
            <span className="battle-vs-label">VS</span>
            <span className="battle-vs-name">
              {myColor === 'black' ? '⚪' : '⚫'} {opponentNickname}
            </span>
          </div>
          <div className="battle-countdown-number">
            {countdown === 0 ? 'GO!' : countdown}
          </div>
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
                <span>{opponentNickname}</span>
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
                <button onClick={startMatchmaking} className="play-again-button">다시 대결</button>
              </div>
            )}

            {phase === 'playing' && (
              <button onClick={handleSurrender} className="reset-button gomoku-surrender">포기</button>
            )}
          </div>

          <div
            className="gomoku-board"
            onMouseLeave={() => setHoverIndex(null)}
          >
            {board.map((stone, index) => {
              const isWinning = winningCells.includes(index)
              const isHover = hoverIndex === index && !stone && isMyTurn

              return (
                <div
                  key={index}
                  className={getCellClasses(index)}
                  onClick={() => handleCellClick(index)}
                  onMouseEnter={() => {
                    if (isMyTurn && !stone) setHoverIndex(index)
                    else setHoverIndex(null)
                  }}
                >
                  {STAR_POINTS.has(index) && !stone && (
                    <div className="gomoku-star" />
                  )}
                  {stone && (
                    <div
                      className={`gomoku-stone gomoku-stone--${stone}${isWinning ? ' gomoku-stone--winning' : ''}`}
                    />
                  )}
                  {isHover && (
                    <div className={`gomoku-stone-ghost gomoku-stone-ghost--${myColor}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
