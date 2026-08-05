import { signIn } from "@/auth"
import { NextResponse } from "next/server"
import { isRateLimited } from "@/lib/rate-limiter"
import { checkLockout } from "@/lib/lockout"
import { auditLog } from "@/lib/audit"
import { csrfCheck } from "@/lib/csrf"

export async function POST(request: Request) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

  const body = await request.json()
  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }

  const rateCheck = isRateLimited(`login:${email}`)
  if (!rateCheck.allowed) {
    auditLog({ event: "LOGIN_RATE_LIMITED", email, retryAfter: rateCheck.retryAfter || 0 })
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rateCheck.retryAfter} seconds.` },
      { status: 429 }
    )
  }

  const { locked, retryAfter } = checkLockout(email)
  if (locked) {
    auditLog({ event: "LOGIN_LOCKED", email, retryAfter: retryAfter || 0 })
    return NextResponse.json(
      { error: `Account temporarily locked. Try again in ${retryAfter} seconds.` },
      { status: 429 }
    )
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    auditLog({ event: "LOGIN_SUCCESS", email })

    return NextResponse.json({ ok: true })
  } catch {
    auditLog({ event: "LOGIN_FAILED", email, reason: "invalid_credentials" })
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }
}
