'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AuthUser } from '@/lib/auth'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { HWATU_DECK, shuffleDeck, deal, getCard } from '@/lib/hwatu'
import type { HwatuCard } from '@/lib/hwatu'
import { emptyPile, addCards, resolvePlay, calculateScore, isPeok } from '@/lib/gostop-rules'
import type { CapturedPile } from '@/lib/gostop-rules'

type GostopPhase = 'idle' | 'matchmaking' | 'countdown' | 'playing' | 'finished'
type SubPhase = 'select_card' | 'awaiting_draw' | 'go_stop_decision'

interface GameState {
  deck: HwatuCard[]              // Player1만 관리
  field: HwatuCard[]
  myHand: HwatuCard[]
  oppHandCount: number
  myCaptured: CapturedPile
  oppCaptured: CapturedPile
  currentTurn: 'me' | 'opponent'
  subPhase: SubPhase
  myGoCount: number
  oppGoCount: number
  myScore: number
  oppScore: number
  myPeokBonus: number
  oppPeokBonus: number
}

const MATCHMAKING_TIMEOUT = 60

function initGameState(): GameState {
  return {
    deck: [],
    field: [],
    myHand: [],
    oppHandCount: 0,
    myCaptured: emptyPile(),
    oppCaptured: emptyPile(),
    currentTurn: 'me',
    subPhase: 'select_card',
    myGoCount: 0,
    oppGoCount: 0,
    myScore: 0,
    oppScore: 0,
    myPeokBonus: 0,
    oppPeokBonus: 0,
  }
}

// 카드 타입 한글 약칭
const TYPE_LABEL: Record<string, string> = {
  bright: '광', animal: '열', ribbon: '띠', chaff: '피',
}
const TYPE_COLOR: Record<string, string> = {
  bright: '#ffd700', animal: '#4fc3f7', ribbon: '#ef9a9a', chaff: '#a5d6a7',
}

interface CardProps {
  card: HwatuCard
  selected?: boolean
  highlighted?: boolean
  onClick?: () => void
  size?: 'normal' | 'small'
  faceDown?: boolean
}

function HwatuCardView({ card, selected, highlighted, onClick, size = 'normal', faceDown }: CardProps) {
  const isSmall = size === 'small'
  const w = isSmall ? 40 : 72
  const h = isSmall ? 56 : 100

  if (faceDown) {
    return (
      <div
        style={{
          width: w, height: h, borderRadius: 6, background: '#2c4a6e',
          border: '2px solid #4a7aad', flexShrink: 0, cursor: 'default',
        }}
      />
    )
  }

  return (
    <div
      onClick={onClick}
      style={{
        width: w, height: h, borderRadius: 6, overflow: 'hidden',
        border: highlighted ? '2px solid #ffd700' : selected ? '2px solid #667eea' : '1px solid #ccc',
        cursor: onClick ? 'pointer' : 'default',
        transform: selected ? 'translateY(-10px)' : 'none',
        transition: 'transform 0.15s',
        flexShrink: 0,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: highlighted ? '0 0 8px #ffd70088' : '0 1px 3px rgba(0,0,0,0.2)',
      }}
    >
      <img
        src={card.imagePath}
        alt={`${card.month}월 ${card.type}`}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        onError={e => {
          const img = e.currentTarget
          img.style.display = 'none'
          const fb = img.nextElementSibling as HTMLElement | null
          if (fb) fb.style.display = 'flex'
        }}
      />
      <div
        style={{
          display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          width: '100%', height: '100%', background: TYPE_COLOR[card.type] || '#eee',
          fontSize: isSmall ? 10 : 13, fontWeight: 700, color: '#333',
          gap: 2,
        }}
      >
        <span>{card.month}월</span>
        <span>{TYPE_LABEL[card.type]}</span>
        {card.isSsangpi && <span style={{ fontSize: 9 }}>쌍피</span>}
        {card.isRainBright && <span style={{ fontSize: 9 }}>비광</span>}
      </div>
    </div>
  )
}

interface Props {
  user: AuthUser | null
  onNeedAuth: () => void
}

export default function GostopGame({ user, onNeedAuth }: Props) {
  const [phase, setPhase] = useState<GostopPhase>('idle')
  const [gameState, setGameState] = useState<GameState>(initGameState)
  const [opponentNickname, setOpponentNickname] = useState('')
  const [countdown, setCountdown] = useState(3)
  const [waitSeconds, setWaitSeconds] = useState(0)
  const [selectedCard, setSelectedCard] = useState<HwatuCard | null>(null)
  const [winner, setWinner] = useState<'me' | 'opponent' | null>(null)
  const [statusMsg, setStatusMsg] = useState('')

  const channelRef = useRef<RealtimeChannel | null>(null)
  const phaseRef = useRef<GostopPhase>('idle')
  const gameStateRef = useRef<GameState>(initGameState())
  const roleRef = useRef<'player1' | 'player2' | null>(null)
  const nicknameRef = useRef(user?.nickname ?? '')
  const matchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { nicknameRef.current = user?.nickname ?? '' }, [user])
  useEffect(() => { phaseRef.current = phase }, [phase])

  const updateGameState = useCallback((updater: (prev: GameState) => GameState) => {
    setGameState(prev => {
      const next = updater(prev)
      gameStateRef.current = next
      return next
    })
  }, [])

  const clearTimers = useCallback(() => {
    if (matchTimerRef.current) { clearInterval(matchTimerRef.current); matchTimerRef.current = null }
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

  useEffect(() => () => { leaveChannel(); clearTimers() }, [leaveChannel, clearTimers])

  // 카운트다운
  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) { setPhase('playing'); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  const finishGame = useCallback((result: 'me' | 'opponent') => {
    clearTimers()
    setWinner(result)
    setPhase('finished')
  }, [clearTimers])

  // 드로우 결과 처리 (양쪽 공통)
  const processDrawResult = useCallback((
    drawnCardId: number,
    takenIds: number[],
    isP: boolean,
    turnOf: 'me' | 'opponent',
  ) => {
    updateGameState(prev => {
      const drawnCard = getCard(drawnCardId)
      const taken = takenIds.map(id => getCard(id))
      let newField = prev.field.filter(f => !takenIds.includes(f.id))

      if (taken.length === 0) {
        newField = [...newField, drawnCard]
      }

      const taker = turnOf === 'me' ? 'myCaptured' : 'oppCaptured'
      const newCaptured = addCards(prev[taker], taken.length > 0 ? taken : [])

      const newMyPeokBonus = prev.myPeokBonus + (isP && turnOf === 'opponent' ? 1 : 0)
      const newOppPeokBonus = prev.oppPeokBonus + (isP && turnOf === 'me' ? 1 : 0)

      const newMyScore = calculateScore(
        turnOf === 'me' ? newCaptured : prev.myCaptured,
        newMyPeokBonus,
      )
      const newOppScore = calculateScore(
        turnOf === 'opponent' ? newCaptured : prev.oppCaptured,
        newOppPeokBonus,
      )

      const scorerScore = turnOf === 'me' ? newMyScore : newOppScore
      const isGoable = scorerScore >= 3 && turnOf === 'me'

      return {
        ...prev,
        field: newField,
        [taker]: newCaptured,
        myPeokBonus: newMyPeokBonus,
        oppPeokBonus: newOppPeokBonus,
        myScore: newMyScore,
        oppScore: newOppScore,
        subPhase: isGoable ? 'go_stop_decision' : 'select_card',
        currentTurn: isGoable ? 'me' : (turnOf === 'me' ? 'opponent' : 'me'),
      }
    })
    setSelectedCard(null)
  }, [updateGameState])

  // Player1이 덱에서 드로우 후 결과 브로드캐스트
  const doDrawAndBroadcast = useCallback((
    playedCard: HwatuCard,
    playedTaken: HwatuCard[],
    fieldAfterPlay: HwatuCard[],
    turnOf: 'me' | 'opponent',
  ) => {
    const gs = gameStateRef.current
    if (gs.deck.length === 0) {
      finishGame(gs.myScore >= gs.oppScore ? 'me' : 'opponent')
      return
    }

    const [drawnCard, ...restDeck] = gs.deck
    const { taken: drawTaken, newField } = resolvePlay(fieldAfterPlay, drawnCard)
    const drawnMatches = fieldAfterPlay.filter(f => f.month === drawnCard.month)
    const playedMatches = playedTaken.slice(1) // exclude played card itself
    const peok = isPeok(playedMatches, drawnMatches, playedCard, drawnCard)
    const takenIds = drawTaken.map(c => c.id)

    // Update deck in state
    updateGameState(prev => ({ ...prev, deck: restDeck }))

    channelRef.current?.send({
      type: 'broadcast',
      event: 'draw_result',
      payload: { cardId: drawnCard.id, takenIds, isPeok: peok, turnOf },
    })

    // Player1 processes locally (self: false means they don't receive own broadcast)
    processDrawResult(drawnCard.id, takenIds, peok, turnOf)
    void newField
  }, [finishGame, updateGameState, processDrawResult])

  // 카드 플레이 처리 (필드 업데이트 + 캡처)
  const processPlayCard = useCallback((
    cardId: number,
    takenIds: number[],
    turnOf: 'me' | 'opponent',
    fromHand: 'mine' | 'opp',
  ) => {
    updateGameState(prev => {
      const playedCard = getCard(cardId)
      const taken = takenIds.map(id => getCard(id))
      let newField = prev.field.filter(f => !takenIds.includes(f.id))
      if (taken.length === 0) {
        newField = [...newField, playedCard]
      }
      const newMyHand = fromHand === 'mine' ? prev.myHand.filter(c => c.id !== cardId) : prev.myHand
      const newOppCount = fromHand === 'opp' ? prev.oppHandCount - 1 : prev.oppHandCount
      const taker = turnOf === 'me' ? 'myCaptured' : 'oppCaptured'
      const newCaptured = addCards(prev[taker], taken)

      return {
        ...prev,
        field: newField,
        myHand: newMyHand,
        oppHandCount: newOppCount,
        [taker]: newCaptured,
        subPhase: 'awaiting_draw',
      }
    })
  }, [updateGameState])

  const setupChannel = useCallback((
    rid: string,
    role: 'player1' | 'player2',
    opponentNick?: string,
  ) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    roleRef.current = role

    const channel = supabase.channel(`gostop:${rid}`, {
      config: { broadcast: { self: false } },
    })

    // Player1이 game_start 수신
    channel.on('broadcast', { event: 'game_start' }, ({ payload }) => {
      if (role !== 'player1' || phaseRef.current !== 'matchmaking') return
      const { hand1Ids, hand2Ids, fieldIds, deckIds, player2Nickname } = payload
      const hand1 = (hand1Ids as number[]).map(getCard)
      const field = (fieldIds as number[]).map(getCard)
      const deck = (deckIds as number[]).map(getCard)

      setOpponentNickname(player2Nickname)
      clearTimers()

      const gs: GameState = {
        ...initGameState(),
        deck,
        field,
        myHand: hand1,
        oppHandCount: (hand2Ids as number[]).length,
        currentTurn: 'me', // Player1 goes first
        subPhase: 'select_card',
      }
      gameStateRef.current = gs
      setGameState(gs)
      setCountdown(3)
      setPhase('countdown')
    })

    // play_card 수신 (상대방이 보낸 것)
    channel.on('broadcast', { event: 'play_card' }, ({ payload }) => {
      if (phaseRef.current !== 'playing') return
      const { cardId, takenIds, turnOf } = payload as { cardId: number; takenIds: number[]; turnOf: 'me' | 'opponent' }

      // from perspective of receiver, the sender's 'me' is our 'opponent'
      const localTurnOf: 'me' | 'opponent' = turnOf === 'me' ? 'opponent' : 'me'
      processPlayCard(cardId, takenIds, localTurnOf, 'opp')

      // Player1이 드로우 담당
      if (role === 'player1') {
        const gs = gameStateRef.current
        const playedCard = getCard(cardId)
        const taken = takenIds.map(id => getCard(id))
        const fieldAfterPlay = gs.field.filter(f => !takenIds.includes(f.id))
        const fieldForDraw = taken.length === 0 ? [...fieldAfterPlay, playedCard] : fieldAfterPlay
        setTimeout(() => doDrawAndBroadcast(playedCard, taken, fieldForDraw, localTurnOf), 300)
      }
    })

    // draw_result 수신 (Player2만 수신; Player1은 로컬 처리)
    channel.on('broadcast', { event: 'draw_result' }, ({ payload }) => {
      if (phaseRef.current !== 'playing') return
      const { cardId, takenIds, isPeok: peok, turnOf } = payload as {
        cardId: number; takenIds: number[]; isPeok: boolean; turnOf: 'me' | 'opponent'
      }
      // flip perspective
      const localTurnOf: 'me' | 'opponent' = turnOf === 'me' ? 'opponent' : 'me'
      processDrawResult(cardId, takenIds, peok, localTurnOf)
    })

    // go_decision 수신
    channel.on('broadcast', { event: 'go_decision' }, ({ payload }) => {
      if (phaseRef.current !== 'playing') return
      const { decision } = payload as { decision: 'go' | 'stop' }
      if (decision === 'stop') {
        // 상대방이 stop → 상대방 승리 (상대방 점수가 3+이므로)
        finishGame('opponent')
        return
      }
      // 상대방 go → 계속
      updateGameState(prev => {
        const newCount = prev.oppGoCount + 1
        setStatusMsg(`상대방이 고를 선언했습니다! (${newCount}번째)`)
        return { ...prev, oppGoCount: newCount, currentTurn: 'me', subPhase: 'select_card' }
      })
    })

    // 상대방 이탈
    channel.on('broadcast', { event: 'opponent_left' }, () => {
      if (phaseRef.current === 'playing' || phaseRef.current === 'countdown' || phaseRef.current === 'matchmaking') {
        finishGame('me')
      }
    })

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      if (role !== 'player2' || !opponentNick) return

      // Player2: 셔플 + 딜 + game_start 브로드캐스트
      setTimeout(() => {
        const shuffled = shuffleDeck()
        const dealt = deal(shuffled)

        channel.send({
          type: 'broadcast',
          event: 'game_start',
          payload: {
            hand1Ids: dealt.hand1.map(c => c.id),
            hand2Ids: dealt.hand2.map(c => c.id),
            fieldIds: dealt.field.map(c => c.id),
            deckIds: dealt.remaining.map(c => c.id),
            player2Nickname: nicknameRef.current,
          },
        })

        setOpponentNickname(opponentNick)
        const gs: GameState = {
          ...initGameState(),
          deck: [],
          field: dealt.field,
          myHand: dealt.hand2,
          oppHandCount: dealt.hand1.length,
          currentTurn: 'opponent', // Player1 goes first
          subPhase: 'awaiting_draw',
        }
        gameStateRef.current = gs
        setGameState(gs)
        clearTimers()
        setCountdown(3)
        setPhase('countdown')
      }, 400)
    })

    channelRef.current = channel
  }, [clearTimers, finishGame, processPlayCard, processDrawResult, doDrawAndBroadcast, updateGameState])

  const handleCancel = useCallback(async () => {
    clearTimers()
    leaveChannel()
    setPhase('idle')
    await fetch('/api/gostop/queue', { method: 'DELETE' }).catch(() => {})
  }, [clearTimers, leaveChannel])

  const startMatchmaking = async () => {
    if (!user) { onNeedAuth(); return }
    clearTimers()
    leaveChannel()
    setGameState(initGameState())
    gameStateRef.current = initGameState()
    setSelectedCard(null)
    setWinner(null)
    setStatusMsg('')
    setPhase('matchmaking')

    let secs = 0
    matchTimerRef.current = setInterval(() => {
      secs++
      setWaitSeconds(secs)
      if (secs >= MATCHMAKING_TIMEOUT) handleCancel()
    }, 1000)

    try {
      const res = await fetch('/api/gostop/queue', { method: 'POST' })
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

  const handleCardSelect = (card: HwatuCard) => {
    const gs = gameStateRef.current
    if (phaseRef.current !== 'playing') return
    if (gs.currentTurn !== 'me') return
    if (gs.subPhase !== 'select_card') return

    if (selectedCard?.id === card.id) {
      // 두 번 클릭으로 확정
      const { taken, newField } = resolvePlay(gs.field, card)
      const takenIds = taken.map(c => c.id)

      processPlayCard(card.id, takenIds, 'me', 'mine')

      channelRef.current?.send({
        type: 'broadcast',
        event: 'play_card',
        payload: { cardId: card.id, takenIds, turnOf: 'me' },
      })

      // Player1만 드로우
      if (roleRef.current === 'player1') {
        const fieldAfterPlay = newField
        setTimeout(() => doDrawAndBroadcast(card, taken, fieldAfterPlay, 'me'), 300)
      }

      setSelectedCard(null)
    } else {
      setSelectedCard(card)
    }
  }

  const handleGoDecision = (decision: 'go' | 'stop') => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'go_decision',
      payload: { decision },
    })

    if (decision === 'stop') {
      finishGame('me')
      return
    }

    updateGameState(prev => {
      const newCount = prev.myGoCount + 1
      setStatusMsg(`고! (${newCount}번째)`)
      return { ...prev, myGoCount: newCount, currentTurn: 'opponent', subPhase: 'select_card' }
    })
  }

  const handleSurrender = () => {
    channelRef.current?.send({ type: 'broadcast', event: 'opponent_left', payload: {} })
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = null
    clearTimers()
    finishGame('opponent')
  }

  const gs = gameState
  const isMyTurn = phase === 'playing' && gs.currentTurn === 'me'
  const totalGoCount = gs.myGoCount + gs.oppGoCount
  const myFinalScore = gs.myScore * Math.max(1, totalGoCount + 1)

  // ===== RENDER =====
  return (
    <div className="gostop-game">
      <h2>고스톱</h2>

      {phase === 'idle' && (
        <div className="start-screen">
          {!user ? (
            <>
              <p style={{ color: '#888' }}>게임을 시작하려면 로그인이 필요합니다.</p>
              <button onClick={onNeedAuth} className="start-button">로그인하고 시작</button>
            </>
          ) : (
            <>
              <p>화투 2인 고스톱 대결!<br />광/열끗/띠/피를 모아 점수를 올리세요.</p>
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
            <span className="battle-vs-name">{nicknameRef.current}</span>
            <span className="battle-vs-label">VS</span>
            <span className="battle-vs-name">{opponentNickname}</span>
          </div>
          <div className="battle-countdown-number">{countdown === 0 ? 'GO!' : countdown}</div>
        </div>
      )}

      {(phase === 'playing' || phase === 'finished') && (
        <div className="gostop-layout">
          {/* 상대방 영역 */}
          <div className="gostop-player-area gostop-player-area--opp">
            <div className="gostop-player-info">
              <span className="gostop-player-name">{opponentNickname}</span>
              <span className="gostop-score-badge">점수: {gs.oppScore}</span>
              {gs.oppGoCount > 0 && (
                <span className="gostop-go-badge">고 {gs.oppGoCount}회</span>
              )}
              <span style={{ fontSize: 12, color: '#888' }}>패: {gs.oppHandCount}장</span>
            </div>
            {/* 상대 뒷면 패 */}
            <div className="gostop-hand gostop-hand--opp">
              {Array.from({ length: gs.oppHandCount }).map((_, i) => (
                <HwatuCardView key={i} card={HWATU_DECK[0]} faceDown size="small" />
              ))}
            </div>
            {/* 상대 잡은 카드 */}
            <div className="gostop-captured-row">
              {gs.oppCaptured.brights.map(c => (
                <HwatuCardView key={c.id} card={c} size="small" />
              ))}
              {gs.oppCaptured.animals.map(c => (
                <HwatuCardView key={c.id} card={c} size="small" />
              ))}
              {gs.oppCaptured.ribbons.map(c => (
                <HwatuCardView key={c.id} card={c} size="small" />
              ))}
              {gs.oppCaptured.chaff.map(c => (
                <HwatuCardView key={c.id} card={c} size="small" />
              ))}
            </div>
          </div>

          {/* 필드 */}
          <div className="gostop-field-area">
            <div className="gostop-field-label">
              {phase === 'playing' && (
                <span className={`gostop-turn-badge ${isMyTurn ? 'gostop-turn-badge--mine' : ''}`}>
                  {isMyTurn
                    ? gs.subPhase === 'go_stop_decision' ? '고/스톱 결정!'
                    : gs.subPhase === 'awaiting_draw' ? '드로우 대기...'
                    : '내 차례 — 카드를 선택하세요'
                    : '상대방 차례...'}
                </span>
              )}
              {statusMsg && <span className="gostop-status-msg">{statusMsg}</span>}
            </div>
            <div className="gostop-field">
              {gs.field.map(c => (
                <HwatuCardView key={c.id} card={c} />
              ))}
            </div>
            {gs.field.length === 0 && (
              <div style={{ color: '#aaa', textAlign: 'center', padding: 16 }}>필드가 비었습니다</div>
            )}
          </div>

          {/* 내 영역 */}
          <div className="gostop-player-area gostop-player-area--me">
            {/* 내 잡은 카드 */}
            <div className="gostop-captured-row">
              {gs.myCaptured.brights.map(c => (
                <HwatuCardView key={c.id} card={c} size="small" />
              ))}
              {gs.myCaptured.animals.map(c => (
                <HwatuCardView key={c.id} card={c} size="small" />
              ))}
              {gs.myCaptured.ribbons.map(c => (
                <HwatuCardView key={c.id} card={c} size="small" />
              ))}
              {gs.myCaptured.chaff.map(c => (
                <HwatuCardView key={c.id} card={c} size="small" />
              ))}
            </div>
            <div className="gostop-player-info">
              <span className="gostop-player-name">{nicknameRef.current} (나)</span>
              <span className="gostop-score-badge">점수: {gs.myScore}</span>
              {gs.myGoCount > 0 && (
                <span className="gostop-go-badge">고 {gs.myGoCount}회</span>
              )}
            </div>

            {/* 내 패 */}
            <div className="gostop-hand">
              {gs.myHand.map(c => (
                <HwatuCardView
                  key={c.id}
                  card={c}
                  selected={selectedCard?.id === c.id}
                  onClick={isMyTurn && gs.subPhase === 'select_card' ? () => handleCardSelect(c) : undefined}
                />
              ))}
            </div>

            {/* 선택한 카드 힌트 */}
            {selectedCard && gs.subPhase === 'select_card' && (
              <p style={{ fontSize: 12, color: '#667eea', margin: '4px 0 0' }}>
                한 번 더 클릭하면 냅니다
              </p>
            )}

            {/* 고/스톱 버튼 */}
            {phase === 'playing' && gs.subPhase === 'go_stop_decision' && gs.currentTurn === 'me' && (
              <div className="gostop-go-stop">
                <span style={{ fontSize: 13, color: '#555', marginRight: 8 }}>
                  현재 점수: {gs.myScore}점 (×{totalGoCount + 1} = {myFinalScore}점)
                </span>
                <button className="gostop-btn gostop-btn--go" onClick={() => handleGoDecision('go')}>고!</button>
                <button className="gostop-btn gostop-btn--stop" onClick={() => handleGoDecision('stop')}>스톱</button>
              </div>
            )}
          </div>

          {/* 게임 컨트롤 */}
          <div className="gostop-controls">
            {phase === 'playing' && (
              <button onClick={handleSurrender} className="reset-button">포기</button>
            )}
            {phase === 'finished' && (
              <div className="gostop-result">
                <div className={`gostop-result-text ${winner === 'me' ? 'gostop-result-win' : 'gostop-result-lose'}`}>
                  {winner === 'me' ? '승리!' : '패배'}
                  {winner === 'me' && totalGoCount > 0 && (
                    <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 8 }}>
                      ({gs.myScore}점 ×{totalGoCount + 1} = {myFinalScore}점)
                    </span>
                  )}
                </div>
                <button onClick={startMatchmaking} className="play-again-button">다시 대결</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
