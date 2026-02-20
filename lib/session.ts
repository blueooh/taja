import { redis } from './redis'
import { randomUUID } from 'crypto'
import type { AuthUser } from './auth'

const SESSION_TTL = 7 * 24 * 60 * 60 // 7일 (초)
const SESSION_PREFIX = 'session:'

export const SESSION_COOKIE = 'taja_session'

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_TTL,
  path: '/',
  sameSite: 'lax' as const,
}

export async function createSession(user: AuthUser): Promise<string> {
  const sessionId = randomUUID()
  await redis.set(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(user), 'EX', SESSION_TTL)
  return sessionId
}

export async function getSession(sessionId: string): Promise<AuthUser | null> {
  const data = await redis.get(`${SESSION_PREFIX}${sessionId}`)
  if (!data) return null
  try {
    return JSON.parse(data) as AuthUser
  } catch {
    return null
  }
}

export async function updateSession(sessionId: string, user: AuthUser): Promise<void> {
  await redis.set(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(user), 'EX', SESSION_TTL)
}

export async function deleteSession(sessionId: string): Promise<void> {
  await redis.del(`${SESSION_PREFIX}${sessionId}`)
}
