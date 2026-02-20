import { NextRequest, NextResponse } from 'next/server'
import { deleteSession, SESSION_COOKIE } from '@/lib/session'

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  if (sessionId) {
    await deleteSession(sessionId).catch(() => {})
  }
  const res = NextResponse.json({ success: true })
  res.cookies.delete(SESSION_COOKIE)
  return res
}
