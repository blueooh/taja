import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { redis } from '@/lib/redis'

const SCORES_KEY = 'taja:scores'
const ENTRY_PREFIX = 'taja:entry:'
const RATE_PREFIX = 'taja:rate:'
const TOP_COUNT = 20

const NICKNAME_REGEX = /^[a-zA-Z0-9가-힣_]{1,20}$/

export interface ScoreEntry {
  id: string
  nickname: string
  wpm: number
  accuracy: number
  time: number
  date: string
}

async function checkRateLimit(ip: string): Promise<boolean> {
  const key = `${RATE_PREFIX}${ip}`
  const current = await redis.incr(key)
  if (current === 1) {
    await redis.expire(key, 60) // 1분 윈도우
  }
  return current <= 10 // 분당 10회 제한
}

export async function GET() {
  try {
    const raw = await redis.zrevrange(SCORES_KEY, 0, TOP_COUNT - 1, 'WITHSCORES')
    if (raw.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const ids: string[] = []
    for (let i = 0; i < raw.length; i += 2) {
      ids.push(raw[i])
    }

    // pipeline으로 N+1 해결
    const pipeline = redis.pipeline()
    ids.forEach(id => pipeline.hgetall(`${ENTRY_PREFIX}${id}`))
    const results = await pipeline.exec()

    const entries: ScoreEntry[] = []
    results?.forEach((result, index) => {
      const detail = result[1] as Record<string, string> | null
      if (detail && detail.nickname) {
        entries.push({
          id: ids[index],
          nickname: detail.nickname,
          wpm: Number(detail.wpm),
          accuracy: Number(detail.accuracy),
          time: Number(detail.time),
          date: detail.date,
        })
      }
    })

    return NextResponse.json({ success: true, data: entries })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '스코어보드를 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
    const allowed = await checkRateLimit(ip)
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { nickname, wpm, accuracy, time } = body

    // 닉네임 검증
    if (typeof nickname !== 'string' || !NICKNAME_REGEX.test(nickname)) {
      return NextResponse.json(
        { success: false, error: '닉네임은 1-20자의 한글, 영문, 숫자, 밑줄만 사용 가능합니다.' },
        { status: 400 }
      )
    }

    // 숫자 필드 범위 검증
    if (
      typeof wpm !== 'number' || !Number.isFinite(wpm) || wpm < 1 || wpm > 500 ||
      typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100 ||
      typeof time !== 'number' || !Number.isFinite(time) || time < 0.5 || time > 600
    ) {
      return NextResponse.json(
        { success: false, error: '잘못된 점수 데이터입니다.' },
        { status: 400 }
      )
    }

    const date = new Date().toISOString()
    const id = randomUUID()
    const score = wpm * 1000 + accuracy

    // 하위 항목 ID 미리 조회 (Hash 고아 데이터 방지)
    const toRemove = await redis.zrange(SCORES_KEY, 0, -(TOP_COUNT + 1))

    // pipeline으로 원자적 처리
    const pipeline = redis.pipeline()
    pipeline.zadd(SCORES_KEY, score, id)
    pipeline.hset(`${ENTRY_PREFIX}${id}`, {
      nickname,
      wpm: String(wpm),
      accuracy: String(accuracy),
      time: String(time),
      date,
    })
    if (toRemove.length > 0) {
      toRemove.forEach(oldId => pipeline.del(`${ENTRY_PREFIX}${oldId}`))
      pipeline.zremrangebyrank(SCORES_KEY, 0, -(TOP_COUNT + 1))
    }
    await pipeline.exec()

    return NextResponse.json({ success: true, data: { id, date } })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '점수 저장에 실패했습니다.' },
      { status: 500 }
    )
  }
}
