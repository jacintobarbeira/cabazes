import { signIn } from "@/auth"
import { NextResponse } from "next/server"
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
