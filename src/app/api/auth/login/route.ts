import { signIn } from "@/auth"
import { NextResponse } from "next/server"
import { auditLog } from "@/lib/audit"
import { csrfCheck } from "@/lib/csrf"
import { isRateLimited } from "@/lib/rate-limiter"
import { checkLockout } from "@/lib/lockout"

export async function POST(request: Request) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

  const body = await request.json()
  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }

  // The credentials authorize() returns null for every failure (including
  // lockout) so the browser path leaks nothing — which means signIn() cannot
  // tell us *why*. Check the same shared throttle rows the browser path
  // increments, so lockout/rate-limit surfaces here as 429 instead of 401.
  const emailKey = String(email)
  const rateCheck = await isRateLimited(`login:${emailKey}`)
  if (!rateCheck.allowed) {
    auditLog({ event: "LOGIN_RATE_LIMITED", email: emailKey, retryAfter: rateCheck.retryAfter || 0 })
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rateCheck.retryAfter} seconds.` },
      { status: 429, headers: { "Retry-After": String(rateCheck.retryAfter ?? 60) } }
    )
  }

  const lockout = await checkLockout(emailKey)
  if (lockout.locked) {
    auditLog({ event: "LOGIN_LOCKED", email: emailKey, retryAfter: lockout.retryAfter || 0 })
    return NextResponse.json(
      { error: `Account temporarily locked. Try again in ${lockout.retryAfter} seconds.` },
      { status: 429, headers: { "Retry-After": String(lockout.retryAfter ?? 60) } }
    )
  }

  try {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    // NextAuth returns null/undefined on failure without throwing when redirect:false in some versions;
    // treat falsy or error-containing result as failure
    if (result && typeof result === "object" && "error" in result && (result as { error?: string }).error) {
      throw new Error((result as { error?: string }).error)
    }

    auditLog({ event: "LOGIN_SUCCESS", email })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Surface lockout/rate-limit messages if authorize returned null due to those
    if (message.toLowerCase().includes("locked") || message.toLowerCase().includes("too many")) {
      return NextResponse.json({ error: message }, { status: 429 })
    }
    auditLog({ event: "LOGIN_FAILED", email, reason: "invalid_credentials" })
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }
}
