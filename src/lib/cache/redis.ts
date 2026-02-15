import { Redis } from '@upstash/redis'

// Upstash Redis client — serverless-compatible
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Cache helper with TTL
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300 // 5 min default
): Promise<T> {
  const cached = await redis.get<T>(key)
  if (cached !== null) return cached

  const fresh = await fetcher()
  await redis.set(key, JSON.stringify(fresh), { ex: ttlSeconds })
  return fresh
}

// Rate limiter helper
export async function checkRateLimit(
  apiName: string,
  maxRequests: number,
  windowSeconds: number = 86400 // 24h default
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `ratelimit:${apiName}:${new Date().toISOString().split('T')[0]}`
  const current = await redis.incr(key)

  if (current === 1) {
    await redis.expire(key, windowSeconds)
  }

  return {
    allowed: current <= maxRequests,
    remaining: Math.max(0, maxRequests - current),
    resetAt: Date.now() + windowSeconds * 1000,
  }
}

// Clear cache by pattern
export async function clearCache(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}
