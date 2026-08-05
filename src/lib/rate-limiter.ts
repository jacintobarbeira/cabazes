interface RateLimitEntry {
  attempts: number[]
}

const rateLimitMap = new Map<string, RateLimitEntry>()

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10

export function isRateLimited(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry) {
    return { allowed: true }
  }

  entry.attempts = entry.attempts.filter(t => now - t < WINDOW_MS)

  if (entry.attempts.length >= MAX_ATTEMPTS) {
    const oldestAttempt = entry.attempts[0]
    const retryAfter = Math.ceil((oldestAttempt + WINDOW_MS - now) / 1000)
    return { allowed: false, retryAfter }
  }

  return { allowed: true }
}

export function recordRateLimitAttempt(key: string) {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry) {
    rateLimitMap.set(key, { attempts: [now] })
    return
  }

  entry.attempts = entry.attempts.filter(t => now - t < WINDOW_MS)
  entry.attempts.push(now)
}

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    entry.attempts = entry.attempts.filter(t => now - t < WINDOW_MS)
    if (entry.attempts.length === 0) {
      rateLimitMap.delete(key)
    }
  }
}, 60 * 1000)
