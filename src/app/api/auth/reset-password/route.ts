import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { auth } from "@/auth"
import { validatePassword } from "@/lib/password-policy"
import { auditLog } from "@/lib/audit"

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { newPassword } = body

  if (!newPassword) {
    return NextResponse.json(
      { error: "New password is required" },
      { status: 400 }
    )
  }

  const passwordError = validatePassword(newPassword)
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      passwordHash,
      mustResetPassword: false,
    },
  })

  auditLog({ event: "PASSWORD_RESET", userId: session.user.id, email: session.user.email || "" })

  return NextResponse.json({ success: true })
}
