import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { redis } from '@/lib/redis'
import { getSession, SESSION_COOKIE } from '@/lib/session'
import { SENTENCES_MAP } from '@/lib/sentences'

type GameType = 'battle' | 'gomoku' | 'gostop'

export interface Room {
  id: string
  gameType: GameType
  hostId: string
  hostNickname: string
  status: 'waiting' | 'playing'
  createdAt: number
  sentence?: string
}

const ROOM_TTL = 300 // 5분
const VALID_GAME_TYPES = new Set<string>(['battle', 'gomoku', 'gostop'])

function getRandomSentence(): string {
  const all = Object.values(SENTENCES_MAP).flat()
  return all[Math.floor(Math.random() * all.length)]
}

export async function GET(req: NextRequest) {
  const gameType = req.nextUrl.searchParams.get('gameType')
  if (!gameType || !VALID_GAME_TYPES.has(gameType)) {
    return NextResponse.json({ success: false, error: '유효하지 않은 gameType' }, { status: 400 })
  }

  const cutoff = Date.now() - ROOM_TTL * 1000
  // 오래된 항목 일괄 정리
  await redis.zremrangebyscore(`rooms:${gameType}`, '-inf', cutoff)
  const roomIds = await redis.zrangebyscore(`rooms:${gameType}`, cutoff, '+inf')

  if (roomIds.length === 0) {
    return NextResponse.json({ success: true, data: [] })
  }

  // N+1 방지: MGET으로 한 번에 조회
  const keys = roomIds.map(id => `room:${id}`)
  const results = await redis.mget(...keys)

  const rooms: Room[] = []
  const staleIds: string[] = []

  for (let i = 0; i < roomIds.length; i++) {
    if (!results[i]) { staleIds.push(roomIds[i]); continue }
    const room = JSON.parse(results[i]!) as Room
    if (room.status === 'waiting') rooms.push(room)
  }

  if (staleIds.length > 0) {
    await redis.zrem(`rooms:${gameType}`, ...staleIds)
  }

  return NextResponse.json({ success: true, data: rooms })
}

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })

  const user = await getSession(sessionId)
  if (!user) return NextResponse.json({ success: false, error: '세션이 만료되었습니다.' }, { status: 401 })

  const body = await req.json() as { gameType?: string }
  const gameType = body.gameType
  if (!gameType || !VALID_GAME_TYPES.has(gameType)) {
    return NextResponse.json({ success: false, error: '유효하지 않은 gameType' }, { status: 400 })
  }

  const roomId = randomUUID()
  const room: Room = {
    id: roomId,
    gameType: gameType as GameType,
    hostId: user.id,
    hostNickname: user.nickname,
    status: 'waiting',
    createdAt: Date.now(),
    ...(gameType === 'battle' && { sentence: getRandomSentence() }),
  }

  await redis.set(`room:${roomId}`, JSON.stringify(room), 'EX', ROOM_TTL)
  await redis.zadd(`rooms:${gameType}`, Date.now(), roomId)

  return NextResponse.json({ success: true, data: { roomId, sentence: room.sentence } })
}
