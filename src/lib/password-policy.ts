import { randomBytes } from "crypto"

export const MIN_PASSWORD_LENGTH = 8

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const LOWER = "abcdefghijklmnopqrstuvwxyz"
const DIGITS = "0123456789"
const SPECIAL = "!@#$%^&*()_+-=[]{}|;:,.<>?"
const ALL = UPPER + LOWER + DIGITS + SPECIAL

function randomChar(charset: string): string {
  const bytes = randomBytes(1)
  return charset[bytes[0] % charset.length]
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter"
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one digit"
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return "Password must contain at least one special character"
  }
  return null
}

export function generateSecurePassword(): string {
  let password = ""
  password += randomChar(UPPER)
  password += randomChar(LOWER)
  password += randomChar(DIGITS)
  password += randomChar(SPECIAL)

  for (let i = 0; i < 8; i++) {
    password += randomChar(ALL)
  }

  const arr = password.split("")
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }

  return arr.join("")
}
