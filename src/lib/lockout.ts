interface LockoutEntry {
  failedAttempts: number
  lockedUntil: number | null
}

const lockoutMap = new Map<string, LockoutEntry>()

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000

export function checkLockout(email: string): { locked: boolean; retryAfter?: number } {
  const entry = lockoutMap.get(email)

  if (!entry) {
    return { locked: false }
  }

  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    const retryAfter = Math.ceil((entry.lockedUntil - Date.now()) / 1000)
    return { locked: true, retryAfter }
  }

  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
    lockoutMap.delete(email)
    return { locked: false }
  }

  return { locked: false }
}

export function recordFailedAttempt(email: string) {
  const entry = lockoutMap.get(email) || { failedAttempts: 0, lockedUntil: null }
  entry.failedAttempts++

  if (entry.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS
  }

  lockoutMap.set(email, entry)
}

export function resetLockout(email: string) {
  lockoutMap.delete(email)
}
