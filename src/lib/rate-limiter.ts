import { prisma } from "./db"
import { NextResponse } from "next/server"

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10
const SCOPE = "rate"

export function rateLimitError(retryAfter?: number): NextResponse {
  return NextResponse.json(
    { error: `Too many attempts. Try again in ${retryAfter} seconds.` },
    { status: 429 }
  )
}

export async function isRateLimited(key: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = new Date()
  const entry = await prisma.authThrottle.findUnique({
    where: { scope_key: { scope: SCOPE, key } },
  })

  if (!entry) {
    return { allowed: true }
  }

  const elapsed = now.getTime() - entry.windowStart.getTime()
  if (elapsed >= WINDOW_MS) {
    await prisma.authThrottle.delete({ where: { id: entry.id } }).catch(() => {})
    return { allowed: true }
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((WINDOW_MS - elapsed) / 1000)
    return { allowed: false, retryAfter }
  }

  return { allowed: true }
}

export async function recordRateLimitAttempt(key: string) {
  const now = new Date()
  const entry = await prisma.authThrottle.findUnique({
    where: { scope_key: { scope: SCOPE, key } },
  })

  if (!entry) {
    await prisma.authThrottle.create({
      data: { scope: SCOPE, key, attempts: 1, windowStart: now },
    })
    return
  }

  const elapsed = now.getTime() - entry.windowStart.getTime()
  if (elapsed >= WINDOW_MS) {
    await prisma.authThrottle.update({
      where: { id: entry.id },
      data: { attempts: 1, windowStart: now },
    })
    return
  }

  await prisma.authThrottle.update({
    where: { id: entry.id },
    data: { attempts: entry.attempts + 1 },
  })
}
