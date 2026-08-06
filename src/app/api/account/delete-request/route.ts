import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { csrfCheck } from "@/lib/csrf"
import { auditLog } from "@/lib/audit"

export async function POST(request: Request) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

  const body = await request.json()
  const { token } = body

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
