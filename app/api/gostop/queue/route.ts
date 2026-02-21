import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { redis } from '@/lib/redis'
import { getSession, SESSION_COOKIE } from '@/lib/session'

const QUEUE_KEY = 'gostop:waiting'
const QUEUE_TTL = 60

interface QueueEntry {
  nickname: string
  roomId: string
}

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })

  const user = await getSession(sessionId)
  if (!user) return NextResponse.json({ success: false, error: '세션이 만료되었습니다.' }, { status: 401 })

  const waiting = await redis.get(QUEUE_KEY)

  if (waiting) {
    const player1 = JSON.parse(waiting) as QueueEntry

    if (player1.nickname === user.nickname) {
      return NextResponse.json({ success: true, status: 'waiting', roomId: player1.roomId })
    }

    const deleted = await redis.del(QUEUE_KEY)
    if (deleted) {
      return NextResponse.json({
        success: true,
        status: 'matched',
        roomId: player1.roomId,
        opponent: player1.nickname,
        role: 'player2',
      })
    }
  }

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
