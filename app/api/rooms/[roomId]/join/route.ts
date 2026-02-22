import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { getSession, SESSION_COOKIE } from '@/lib/session'
import type { Room } from '../../route'

// 원자적으로: 방 상태 확인 → playing으로 변경 → Sorted Set에서 제거
// 반환값: 'not_found' | 'already_playing' | 'self_join' | <JSON 문자열>
const JOIN_ROOM_SCRIPT = `
local data = redis.call('GET', KEYS[1])
if not data then return 'not_found' end
local room = cjson.decode(data)
if room['status'] ~= 'waiting' then return 'already_playing' end
if room['hostId'] == ARGV[1] then return 'self_join' end
room['status'] = 'playing'
redis.call('SET', KEYS[1], cjson.encode(room), 'EX', 3600)
redis.call('ZREM', KEYS[2], ARGV[2])
return cjson.encode(room)
`

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })

  const user = await getSession(sessionId)
  if (!user) return NextResponse.json({ success: false, error: '세션이 만료되었습니다.' }, { status: 401 })

  const { roomId } = await params

  // 임시 조회: gameType을 알아야 Sorted Set 키를 만들 수 있음
  const data = await redis.get(`room:${roomId}`)
  if (!data) return NextResponse.json({ success: false, error: '방을 찾을 수 없습니다.' }, { status: 404 })
  const roomForType = JSON.parse(data) as Room

  const result = await redis.eval(
    JOIN_ROOM_SCRIPT,
    2,
    `room:${roomId}`,
    `rooms:${roomForType.gameType}`,
    user.id,
    roomId,
  ) as string

  if (result === 'not_found') {
    return NextResponse.json({ success: false, error: '방을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (result === 'already_playing') {
    return NextResponse.json({ success: false, error: '이미 시작된 방입니다.' }, { status: 409 })
  }
  if (result === 'self_join') {
    return NextResponse.json({ success: false, error: '자신의 방에 입장할 수 없습니다.' }, { status: 400 })
  }

  const room = JSON.parse(result) as Room

  return NextResponse.json({
    success: true,
    data: {
      roomId,
      hostNickname: room.hostNickname,
      sentence: room.sentence,
    },
  })
}
