import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { getSession, SESSION_COOKIE } from '@/lib/session'
import type { Room } from '../route'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) return NextResponse.json({ success: false }, { status: 401 })

  const user = await getSession(sessionId)
  if (!user) return NextResponse.json({ success: false }, { status: 401 })

  const { roomId } = await params
  const data = await redis.get(`room:${roomId}`)
  if (!data) return NextResponse.json({ success: true })

  const room = JSON.parse(data) as Room
  if (room.hostId !== user.id) {
    return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 })
  }

  await redis.del(`room:${roomId}`)
  await redis.zrem(`rooms:${room.gameType}`, roomId)

  return NextResponse.json({ success: true })
}
