'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AuthUser } from '@/lib/auth'
import type { RealtimeChannel } from '@supabase/supabase-js'
import GameChat from '@/components/GameChat'
import { HWATU_DECK, shuffleDeck, deal, getCard } from '@/lib/hwatu'
import type { HwatuCard } from '@/lib/hwatu'
import { emptyPile, addCards, resolvePlay, calculateScore, isPeok } from '@/lib/gostop-rules'
import type { CapturedPile } from '@/lib/gostop-rules'

type GostopPhase = 'room_list' | 'waiting' | 'countdown' | 'playing' | 'finished'
type SubPhase = 'select_card' | 'awaiting_draw' | 'go_stop_decision'

interface GameState {
  deck: HwatuCard[]
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

interface RoomItem { id: string; hostNickname: string; createdAt: number }
interface Props { user: AuthUser | null; onNeedAuth: () => void }

const TYPE_LABEL: Record<string, string> = { bright: '광', animal: '열', ribbon: '띠', chaff: '피' }
const TYPE_COLOR: Record<string, string> = { bright: '#ffd700', animal: '#4fc3f7', ribbon: '#ef9a9a', chaff: '#a5d6a7' }

function initGameState(): GameState {
  return {
    deck: [], field: [], myHand: [], oppHandCount: 0,
    myCaptured: emptyPile(), oppCaptured: emptyPile(),
    currentTurn: 'me', subPhase: 'select_card',
    myGoCount: 0, oppGoCount: 0, myScore: 0, oppScore: 0, myPeokBonus: 0, oppPeokBonus: 0,
  }
}

interface CardProps {
  card: HwatuCard; selected?: boolean; highlighted?: boolean
  onClick?: () => void; size?: 'normal' | 'compact' | 'small'; faceDown?: boolean
}

const CARD_DIMS = {
  normal:  { w: 72,  h: 100, fs: 13 },
  compact: { w: 52,  h: 72,  fs: 10 },
  small:   { w: 40,  h: 56,  fs: 10 },
}

function HwatuCardView({ card, selected, highlighted, onClick, size = 'normal', faceDown }: CardProps) {
  const { w, h, fs } = CARD_DIMS[size]
  if (faceDown) {
    return <div style={{ width: w, height: h, borderRadius: 5, background: '#2c4a6e', border: '2px solid #4a7aad', flexShrink: 0 }} />
  }
  return (
    <div
      onClick={onClick}
      style={{
        width: w, height: h, borderRadius: 5, overflow: 'hidden', flexShrink: 0, background: '#fff',
        border: highlighted ? '2px solid #ffd700' : selected ? '2px solid #667eea' : '1px solid #ccc',
        cursor: onClick ? 'pointer' : 'default',
        transform: selected ? 'translateY(-8px)' : 'none',
        transition: 'transform 0.15s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        boxShadow: highlighted ? '0 0 8px #ffd70088' : '0 1px 3px rgba(0,0,0,0.2)',
      }}
    >
      <img
        src={card.imagePath} alt={`${card.month}월 ${card.type}`}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        onError={e => {
          const img = e.currentTarget; img.style.display = 'none'
          const fb = img.nextElementSibling as HTMLElement | null
          if (fb) fb.style.display = 'flex'
        }}
      />
      <div style={{
        display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%', background: TYPE_COLOR[card.type] || '#eee',
        fontSize: fs, fontWeight: 700, color: '#333', gap: 2,
      }}>
        <span>{card.month}월</span><span>{TYPE_LABEL[card.type]}</span>
        {card.isSsangpi && <span style={{ fontSize: 8 }}>쌍피</span>}
        {card.isRainBright && <span style={{ fontSize: 8 }}>비광</span>}
      </div>
    </div>
  )
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

export default function GostopGame({ user, onNeedAuth }: Props) {
  const isMobile = useIsMobile()
  const fieldCardSize = isMobile ? 'compact' : 'normal'
  const handCardSize  = isMobile ? 'compact' : 'normal'

  const [phase, setPhase] = useState<GostopPhase>('room_list')
  const [rooms, setRooms] = useState<RoomItem[]>([])
  const [gameState, setGameState] = useState<GameState>(initGameState)
  const [opponentNickname, setOpponentNickname] = useState('')
  const [countdown, setCountdown] = useState(3)
  const [selectedCard, setSelectedCard] = useState<HwatuCard | null>(null)
  const [winner, setWinner] = useState<'me' | 'opponent' | null>(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [myRoomId, setMyRoomId] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const phaseRef = useRef<GostopPhase>('room_list')
  const gameStateRef = useRef<GameState>(initGameState())
  const roleRef = useRef<'player1' | 'player2' | null>(null)
  const nicknameRef = useRef(user?.nickname ?? '')
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { nicknameRef.current = user?.nickname ?? '' }, [user])
  useEffect(() => { phaseRef.current = phase }, [phase])

  const updateGameState = useCallback((updater: (prev: GameState) => GameState) => {
    setGameState(prev => { const next = updater(prev); gameStateRef.current = next; return next })
  }, [])

  const leaveChannel = useCallback(() => {
    if (!channelRef.current) return
    const cur = phaseRef.current
    if (cur === 'playing' || cur === 'countdown') {
      channelRef.current.send({ type: 'broadcast', event: 'opponent_left', payload: {} })
    }
    supabase.removeChannel(channelRef.current); channelRef.current = null
  }, [])

  useEffect(() => () => leaveChannel(), [leaveChannel])

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/rooms?gameType=gostop')
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
    if (countdown <= 0) { setPhase('playing'); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  const finishGame = useCallback((result: 'me' | 'opponent') => {
    setWinner(result); setPhase('finished'); phaseRef.current = 'finished'
  }, [])

  const processDrawResult = useCallback((drawnCardId: number, takenIds: number[], isP: boolean, turnOf: 'me' | 'opponent') => {
    updateGameState(prev => {
      const drawnCard = getCard(drawnCardId)
      const taken = takenIds.map(id => getCard(id))
      let newField = prev.field.filter(f => !takenIds.includes(f.id))
      if (taken.length === 0) newField = [...newField, drawnCard]
      const taker = turnOf === 'me' ? 'myCaptured' : 'oppCaptured'
      const newCaptured = addCards(prev[taker], taken.length > 0 ? taken : [])
      const newMyPeokBonus = prev.myPeokBonus + (isP && turnOf === 'opponent' ? 1 : 0)
      const newOppPeokBonus = prev.oppPeokBonus + (isP && turnOf === 'me' ? 1 : 0)
      const newMyScore = calculateScore(turnOf === 'me' ? newCaptured : prev.myCaptured, newMyPeokBonus)
      const newOppScore = calculateScore(turnOf === 'opponent' ? newCaptured : prev.oppCaptured, newOppPeokBonus)
      const isGoable = (turnOf === 'me' ? newMyScore : newOppScore) >= 3 && turnOf === 'me'
      return {
        ...prev, field: newField, [taker]: newCaptured,
        myPeokBonus: newMyPeokBonus, oppPeokBonus: newOppPeokBonus,
        myScore: newMyScore, oppScore: newOppScore,
        subPhase: isGoable ? 'go_stop_decision' : 'select_card',
        currentTurn: isGoable ? 'me' : (turnOf === 'me' ? 'opponent' : 'me'),
      }
    })
    setSelectedCard(null)
  }, [updateGameState])

  const doDrawAndBroadcast = useCallback((
    playedCard: HwatuCard, playedTaken: HwatuCard[], fieldAfterPlay: HwatuCard[], turnOf: 'me' | 'opponent',
  ) => {
    const gs = gameStateRef.current
    if (gs.deck.length === 0) { finishGame(gs.myScore >= gs.oppScore ? 'me' : 'opponent'); return }
    const [drawnCard, ...restDeck] = gs.deck
    const { taken: drawTaken, newField } = resolvePlay(fieldAfterPlay, drawnCard)
    const peok = isPeok(playedTaken.slice(1), fieldAfterPlay.filter(f => f.month === drawnCard.month), playedCard, drawnCard)
    const takenIds = drawTaken.map(c => c.id)
    updateGameState(prev => ({ ...prev, deck: restDeck }))
    channelRef.current?.send({ type: 'broadcast', event: 'draw_result', payload: { cardId: drawnCard.id, takenIds, isPeok: peok, turnOf } })
    processDrawResult(drawnCard.id, takenIds, peok, turnOf)
    void newField
  }, [finishGame, updateGameState, processDrawResult])

  const processPlayCard = useCallback((cardId: number, takenIds: number[], turnOf: 'me' | 'opponent', fromHand: 'mine' | 'opp') => {
    updateGameState(prev => {
      const playedCard = getCard(cardId)
      const taken = takenIds.map(id => getCard(id))
      let newField = prev.field.filter(f => !takenIds.includes(f.id))
      if (taken.length === 0) newField = [...newField, playedCard]
      const taker = turnOf === 'me' ? 'myCaptured' : 'oppCaptured'
      return {
        ...prev, field: newField,
        myHand: fromHand === 'mine' ? prev.myHand.filter(c => c.id !== cardId) : prev.myHand,
        oppHandCount: fromHand === 'opp' ? prev.oppHandCount - 1 : prev.oppHandCount,
        [taker]: addCards(prev[taker], taken), subPhase: 'awaiting_draw',
      }
    })
  }, [updateGameState])

  const setupChannel = useCallback((rid: string, role: 'player1' | 'player2', opponentNick?: string) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    roleRef.current = role

    const channel = supabase.channel(`gostop:${rid}`, { config: { broadcast: { self: false } } })

    channel.on('broadcast', { event: 'game_start' }, ({ payload }) => {
      if (role !== 'player1' || phaseRef.current !== 'waiting') return
      const { hand1Ids, hand2Ids, fieldIds, deckIds, player2Nickname } = payload
      setOpponentNickname(player2Nickname)
      const gs: GameState = {
        ...initGameState(),
        deck: (deckIds as number[]).map(getCard),
        field: (fieldIds as number[]).map(getCard),
        myHand: (hand1Ids as number[]).map(getCard),
        oppHandCount: (hand2Ids as number[]).length,
        currentTurn: 'me', subPhase: 'select_card',
      }
      gameStateRef.current = gs; setGameState(gs)
      setCountdown(3); setPhase('countdown'); phaseRef.current = 'countdown'
    })

    channel.on('broadcast', { event: 'play_card' }, ({ payload }) => {
      if (phaseRef.current !== 'playing') return
      const { cardId, takenIds, turnOf } = payload as { cardId: number; takenIds: number[]; turnOf: 'me' | 'opponent' }
      const localTurnOf: 'me' | 'opponent' = turnOf === 'me' ? 'opponent' : 'me'
      processPlayCard(cardId, takenIds, localTurnOf, 'opp')
      if (role === 'player1') {
        const gs = gameStateRef.current
        const playedCard = getCard(cardId)
        const taken = takenIds.map(id => getCard(id))
        const fieldAfterPlay = gs.field.filter(f => !takenIds.includes(f.id))
        const fieldForDraw = taken.length === 0 ? [...fieldAfterPlay, playedCard] : fieldAfterPlay
        setTimeout(() => doDrawAndBroadcast(playedCard, taken, fieldForDraw, localTurnOf), 300)
      }
    })

    channel.on('broadcast', { event: 'draw_result' }, ({ payload }) => {
      if (phaseRef.current !== 'playing') return
      const { cardId, takenIds, isPeok: peok, turnOf } = payload as { cardId: number; takenIds: number[]; isPeok: boolean; turnOf: 'me' | 'opponent' }
      processDrawResult(cardId, takenIds, peok, turnOf === 'me' ? 'opponent' : 'me')
    })

    channel.on('broadcast', { event: 'go_decision' }, ({ payload }) => {
      if (phaseRef.current !== 'playing') return
      if (payload.decision === 'stop') { finishGame('opponent'); return }
      updateGameState(prev => {
        const newCount = prev.oppGoCount + 1
        setStatusMsg(`상대방이 고를 선언했습니다! (${newCount}번째)`)
        return { ...prev, oppGoCount: newCount, currentTurn: 'me', subPhase: 'select_card' }
      })
    })

    channel.on('broadcast', { event: 'opponent_left' }, () => {
      const cur = phaseRef.current
      if (cur === 'playing' || cur === 'countdown' || cur === 'waiting') finishGame('me')
    })

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED' || role !== 'player2' || !opponentNick) return
      setTimeout(() => {
        const shuffled = shuffleDeck()
        const dealt = deal(shuffled)
        channel.send({
          type: 'broadcast', event: 'game_start',
          payload: {
            hand1Ids: dealt.hand1.map(c => c.id), hand2Ids: dealt.hand2.map(c => c.id),
            fieldIds: dealt.field.map(c => c.id), deckIds: dealt.remaining.map(c => c.id),
            player2Nickname: nicknameRef.current,
          },
        })
        setOpponentNickname(opponentNick)
        const gs: GameState = {
          ...initGameState(), deck: [], field: dealt.field,
          myHand: dealt.hand2, oppHandCount: dealt.hand1.length,
          currentTurn: 'opponent', subPhase: 'awaiting_draw',
        }
        gameStateRef.current = gs; setGameState(gs)
        setCountdown(3); setPhase('countdown'); phaseRef.current = 'countdown'
      }, 400)
    })

    channelRef.current = channel
  }, [finishGame, processPlayCard, processDrawResult, doDrawAndBroadcast, updateGameState])

  const goToRoomList = useCallback(() => {
    leaveChannel()
    setGameState(initGameState()); gameStateRef.current = initGameState()
    setSelectedCard(null); setWinner(null); setStatusMsg(''); setMyRoomId(null)
    setPhase('room_list'); phaseRef.current = 'room_list'
  }, [leaveChannel])

  const handleCreateRoom = async () => {
    if (!user) { onNeedAuth(); return }
    const res = await fetch('/api/rooms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameType: 'gostop' }),
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

  const handleCardSelect = (card: HwatuCard) => {
    const gs = gameStateRef.current
    if (phaseRef.current !== 'playing' || gs.currentTurn !== 'me' || gs.subPhase !== 'select_card') return
    if (selectedCard?.id === card.id) {
      const { taken, newField } = resolvePlay(gs.field, card)
      const takenIds = taken.map(c => c.id)
      processPlayCard(card.id, takenIds, 'me', 'mine')
      channelRef.current?.send({ type: 'broadcast', event: 'play_card', payload: { cardId: card.id, takenIds, turnOf: 'me' } })
      if (roleRef.current === 'player1') {
        setTimeout(() => doDrawAndBroadcast(card, taken, newField, 'me'), 300)
      }
      setSelectedCard(null)
    } else {
      setSelectedCard(card)
    }
  }

  const handleGoDecision = (decision: 'go' | 'stop') => {
    channelRef.current?.send({ type: 'broadcast', event: 'go_decision', payload: { decision } })
    if (decision === 'stop') { finishGame('me'); return }
    updateGameState(prev => {
      const newCount = prev.myGoCount + 1
      setStatusMsg(`고! (${newCount}번째)`)
      return { ...prev, myGoCount: newCount, currentTurn: 'opponent', subPhase: 'select_card' }
    })
  }

  const handleSurrender = () => {
    channelRef.current?.send({ type: 'broadcast', event: 'opponent_left', payload: {} })
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    finishGame('opponent')
  }

  const gs = gameState
  const isMyTurn = phase === 'playing' && gs.currentTurn === 'me'
  const totalGoCount = gs.myGoCount + gs.oppGoCount
  const myFinalScore = gs.myScore * Math.max(1, totalGoCount + 1)

  return (
    <div className="gostop-game">
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
            <span className="battle-vs-name">{nicknameRef.current}</span>
            <span className="battle-vs-label">VS</span>
            <span className="battle-vs-name">{opponentNickname}</span>
          </div>
          <div className="battle-countdown-number">{countdown === 0 ? 'GO!' : countdown}</div>
        </div>
      )}

      {(phase === 'playing' || phase === 'finished') && (
        <div className="gostop-layout">
          <div className="gostop-player-area gostop-player-area--opp">
            <div className="gostop-player-info">
              <GameChat myNickname={user?.nickname ?? ''} opponentNickname={opponentNickname} />
              <span className="gostop-score-badge">점수: {gs.oppScore}</span>
              {gs.oppGoCount > 0 && <span className="gostop-go-badge">고 {gs.oppGoCount}회</span>}
              <span style={{ fontSize: 12, color: '#888' }}>패: {gs.oppHandCount}장</span>
            </div>
            <div className="gostop-hand gostop-hand--opp">
              {Array.from({ length: gs.oppHandCount }).map((_, i) => (
                <HwatuCardView key={i} card={HWATU_DECK[0]} faceDown size="small" />
              ))}
            </div>
            <div className="gostop-captured-row">
              {[...gs.oppCaptured.brights, ...gs.oppCaptured.animals, ...gs.oppCaptured.ribbons, ...gs.oppCaptured.chaff].map(c => (
                <HwatuCardView key={c.id} card={c} size="small" />
              ))}
            </div>
          </div>

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
              {gs.field.map(c => <HwatuCardView key={c.id} card={c} size={fieldCardSize} />)}
            </div>
            {gs.field.length === 0 && <div style={{ color: '#aaa', textAlign: 'center', padding: 16 }}>필드가 비었습니다</div>}
          </div>

          <div className="gostop-player-area gostop-player-area--me">
            <div className="gostop-captured-row">
              {[...gs.myCaptured.brights, ...gs.myCaptured.animals, ...gs.myCaptured.ribbons, ...gs.myCaptured.chaff].map(c => (
                <HwatuCardView key={c.id} card={c} size="small" />
              ))}
            </div>
            <div className="gostop-player-info">
              <span className="gostop-player-name">{nicknameRef.current} (나)</span>
              <span className="gostop-score-badge">점수: {gs.myScore}</span>
              {gs.myGoCount > 0 && <span className="gostop-go-badge">고 {gs.myGoCount}회</span>}
            </div>
            <div className="gostop-hand">
              {gs.myHand.map(c => (
                <HwatuCardView
                  key={c.id} card={c} size={handCardSize} selected={selectedCard?.id === c.id}
                  onClick={isMyTurn && gs.subPhase === 'select_card' ? () => handleCardSelect(c) : undefined}
                />
              ))}
            </div>
            {selectedCard && gs.subPhase === 'select_card' && (
              <p style={{ fontSize: 12, color: '#667eea', margin: '4px 0 0' }}>한 번 더 클릭하면 냅니다</p>
            )}
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

          <div className="gostop-controls">
            {phase === 'playing' && <button onClick={handleSurrender} className="reset-button">포기</button>}
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
                <button onClick={goToRoomList} className="play-again-button">방 목록으로</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
