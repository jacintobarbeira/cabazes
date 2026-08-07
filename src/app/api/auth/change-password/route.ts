import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { validatePassword } from "@/lib/password-policy"
import { isRateLimited, recordRateLimitAttempt, rateLimitError } from "@/lib/rate-limiter"
import { auditLog } from "@/lib/audit"
import { requireSession } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"
import { hashPassword, verifyPassword } from "@/lib/passwords"

export const POST = withCsrf(
  async (request: Request): Promise<Response> => {
    const guard = await requireSession()
    if (!guard.ok) return guard.error

    const userId = guard.user.id
    const rateKey = `change-pw:${userId}`

    const rateCheck = await isRateLimited(rateKey)
    if (!rateCheck.allowed) {
      return rateLimitError(rateCheck.retryAfter)
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      )
    }

    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, email: true },
    })

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Cannot change password for this account" }, { status: 400 })
    }

    const isMatch = await verifyPassword(currentPassword, user.passwordHash)
    if (!isMatch) {
      await recordRateLimitAttempt(rateKey)
      auditLog({ event: "PASSWORD_CHANGE_FAILED", userId, email: user.email, reason: "wrong_current_password" })
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 })
    }

    const passwordHash = await hashPassword(newPassword)

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    })

    auditLog({ event: "PASSWORD_CHANGED", userId, email: user.email })

    return NextResponse.json({ ok: true })
  }
)
