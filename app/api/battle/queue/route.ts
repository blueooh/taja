import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { redis } from '@/lib/redis'
import { getSession, SESSION_COOKIE } from '@/lib/session'
import { SENTENCES_MAP } from '@/lib/sentences'

const QUEUE_KEY = 'battle:waiting'
const QUEUE_TTL = 60 // seconds

interface QueueEntry {
  nickname: string
  roomId: string
}

function getRandomSentence(): string {
  const all = Object.values(SENTENCES_MAP).flat()
  return all[Math.floor(Math.random() * all.length)]
}

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })

  const user = await getSession(sessionId)
  if (!user) return NextResponse.json({ success: false, error: '세션이 만료되었습니다.' }, { status: 401 })

  const waiting = await redis.get(QUEUE_KEY)

  if (waiting) {
    const player1 = JSON.parse(waiting) as QueueEntry

    // 자기 자신과는 매칭하지 않음
    if (player1.nickname === user.nickname) {
      return NextResponse.json({ success: true, status: 'waiting', roomId: player1.roomId })
    }

    // 원자적으로 슬롯 획득 시도
    const deleted = await redis.del(QUEUE_KEY)
    if (deleted) {
      return NextResponse.json({
        success: true,
        status: 'matched',
        roomId: player1.roomId,
        sentence: getRandomSentence(),
        opponent: player1.nickname,
        role: 'player2',
      })
    }
    // 경쟁 조건: 다른 플레이어가 먼저 획득 → 대기로 전환
  }

  // 대기열 생성
  const roomId = randomUUID()
  await redis.set(QUEUE_KEY, JSON.stringify({ nickname: user.nickname, roomId }), 'EX', QUEUE_TTL)
  return NextResponse.json({ success: true, status: 'waiting', roomId })
}

export async function DELETE(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) return NextResponse.json({ success: false }, { status: 401 })

  const user = await getSession(sessionId)
  if (!user) return NextResponse.json({ success: false }, { status: 401 })

  const waiting = await redis.get(QUEUE_KEY)
  if (waiting) {
    const entry = JSON.parse(waiting) as QueueEntry
    if (entry.nickname === user.nickname) {
      await redis.del(QUEUE_KEY)
    }
  }

  return NextResponse.json({ success: true })
}
