import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { csrfCheck } from "@/lib/csrf"
import { auditLog } from "@/lib/audit"
import { requireSession } from "@/lib/auth-helpers"

export async function POST(request: Request) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

  const body = await request.json()
  const { token, currentPassword } = body

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 })
  }

  const inviteToken = await prisma.inviteToken.findUnique({
    where: { token },
    include: { customer: true },
  })

  if (!inviteToken || !inviteToken.customer) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 })
  }

  const customer = inviteToken.customer

  // Verified customers require authenticated step-up confirmation
  if (customer.passwordHash) {
    const guard = await requireSession()
    if (!guard.ok) return guard.error
    if (inviteToken.customerId !== guard.user.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 })
    }
    if (!currentPassword) {
      return NextResponse.json({ error: "currentPassword is required" }, { status: 400 })
    }
    const { verifyPassword } = await import("@/lib/passwords")
    if (!(await verifyPassword(currentPassword, customer.passwordHash))) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 })
    }
  } else {
    // Unverified customers: token-only is sufficient, but token must be unexpired and belong to customer
    if (inviteToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 })
    }
  }

  if (customer.disabled) {
    return NextResponse.json({ ok: true })
  }

  await prisma.user.update({
    where: { id: customer.id },
    data: { disabled: true },
  })

  auditLog({ event: "CUSTOMER_DELETE_REQUESTED", customerId: customer.id, customerEmail: customer.email })

  return NextResponse.json({ ok: true })
}
