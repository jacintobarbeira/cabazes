import { prisma } from "./db"

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000
const SCOPE = "lockout"

export async function checkLockout(email: string): Promise<{ locked: boolean; retryAfter?: number }> {
  const entry = await prisma.authThrottle.findUnique({
    where: { scope_key: { scope: SCOPE, key: email } },
  })

  if (!entry) {
    return { locked: false }
  }

  if (entry.lockedUntil && Date.now() < entry.lockedUntil.getTime()) {
    const retryAfter = Math.ceil((entry.lockedUntil.getTime() - Date.now()) / 1000)
    return { locked: true, retryAfter }
  }

  if (entry.lockedUntil && Date.now() >= entry.lockedUntil.getTime()) {
    await prisma.authThrottle.delete({ where: { id: entry.id } }).catch(() => {})
    return { locked: false }
  }

  return { locked: false }
}

export async function recordFailedAttempt(email: string) {
  const entry = await prisma.authThrottle.findUnique({
    where: { scope_key: { scope: SCOPE, key: email } },
  })

  const failedAttempts = (entry?.attempts ?? 0) + 1
  const lockedUntil =
    failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null

  if (!entry) {
    await prisma.authThrottle.create({
      data: { scope: SCOPE, key: email, attempts: failedAttempts, lockedUntil },
    })
    return
  }

  await prisma.authThrottle.update({
    where: { id: entry.id },
    data: { attempts: failedAttempts, lockedUntil },
  })
}

export async function resetLockout(email: string) {
  await prisma.authThrottle.deleteMany({
    where: { scope: SCOPE, key: email },
  })
}
