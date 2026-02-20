import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { redis } from '@/lib/redis'

// Redis 키 구조: scores:{gameType}, score:{gameType}:{id}
const scoresKey = (gameType: string) => `scores:${gameType}`
const entryKey = (gameType: string, id: string) => `score:${gameType}:${id}`
const RATE_PREFIX = 'rate:'
const TOP_COUNT = 20

const NICKNAME_REGEX = /^[a-zA-Z0-9가-힣_]{1,20}$/
const VALID_GAME_TYPES = ['typing', 'acidrain'] as const
export type GameType = typeof VALID_GAME_TYPES[number]

export interface ScoreEntry {
  id: string
  gameType: GameType
  nickname: string
  wpm: number
  accuracy: number
  time: number
  date: string
}

async function checkRateLimit(ip: string): Promise<boolean> {
  const key = `${RATE_PREFIX}${ip}`
  const current = await redis.incr(key)
  if (current === 1) await redis.expire(key, 60)
  return current <= 10
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const gameType = (searchParams.get('gameType') ?? 'typing') as GameType

    if (!VALID_GAME_TYPES.includes(gameType)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 게임 타입입니다.' }, { status: 400 })
    }

    const raw = await redis.zrevrange(scoresKey(gameType), 0, TOP_COUNT - 1, 'WITHSCORES')
    if (raw.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const ids: string[] = []
    for (let i = 0; i < raw.length; i += 2) ids.push(raw[i])

    const pipeline = redis.pipeline()
    ids.forEach(id => pipeline.hgetall(entryKey(gameType, id)))
    const results = await pipeline.exec()

    const entries: ScoreEntry[] = []
    results?.forEach((result, index) => {
      const detail = result[1] as Record<string, string> | null
      if (detail?.nickname) {
        entries.push({
          id: ids[index],
          gameType,
          nickname: detail.nickname,
          wpm: Number(detail.wpm),
          accuracy: Number(detail.accuracy),
          time: Number(detail.time),
          date: detail.date,
        })
      }
    })

    return NextResponse.json({ success: true, data: entries })
  } catch {
    return NextResponse.json({ success: false, error: '스코어보드를 불러오는데 실패했습니다.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
    if (!(await checkRateLimit(ip))) {
      return NextResponse.json({ success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 })
    }

    const body = await req.json()
    const { nickname, wpm, accuracy, time, gameType = 'typing' } = body

    if (!VALID_GAME_TYPES.includes(gameType)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 게임 타입입니다.' }, { status: 400 })
    }

    if (typeof nickname !== 'string' || !NICKNAME_REGEX.test(nickname)) {
      return NextResponse.json({ success: false, error: '닉네임은 1-20자의 한글, 영문, 숫자, 밑줄만 사용 가능합니다.' }, { status: 400 })
    }

    if (
      typeof wpm !== 'number' || !Number.isFinite(wpm) || wpm < 1 || wpm > 9999999 ||
      typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100 ||
      typeof time !== 'number' || !Number.isFinite(time) || time < 0.5 || time > 600
    ) {
      return NextResponse.json({ success: false, error: '잘못된 점수 데이터입니다.' }, { status: 400 })
    }

    const date = new Date().toISOString()
    const id = randomUUID()
    const score = wpm * 1000 + accuracy
    const sKey = scoresKey(gameType)

    const toRemove = await redis.zrange(sKey, 0, -(TOP_COUNT + 1))

    const pipeline = redis.pipeline()
    pipeline.zadd(sKey, score, id)
    pipeline.hset(entryKey(gameType, id), {
      nickname,
      gameType,
      wpm: String(wpm),
      accuracy: String(accuracy),
      time: String(time),
      date,
    })
    if (toRemove.length > 0) {
      toRemove.forEach(oldId => pipeline.del(entryKey(gameType, oldId)))
      pipeline.zremrangebyrank(sKey, 0, -(TOP_COUNT + 1))
    }
    await pipeline.exec()

    return NextResponse.json({ success: true, data: { id, date } })
  } catch {
    return NextResponse.json({ success: false, error: '점수 저장에 실패했습니다.' }, { status: 500 })
  }
}
