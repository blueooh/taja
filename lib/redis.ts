import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as { redis: Redis | undefined }

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error('REDIS_URL 환경변수가 설정되지 않았습니다.')
  }
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  })
  client.on('error', (err) => {
    console.error('Redis 연결 오류:', err)
  })
  return client
}

export const redis = globalForRedis.redis ?? createRedisClient()

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis
}
