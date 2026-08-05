import { prisma } from "@/lib/db"
import { toUserDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import bcrypt from "bcryptjs"
import { generateSecurePassword } from "@/lib/password-policy"
import { auditLog } from "@/lib/audit"
import { csrfCheck } from "@/lib/csrf"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id || session.user?.role !== "ADMINISTRATOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const farmers = await prisma.user.findMany({
    where: { role: "FARMER" },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(farmers.map(toUserDTO))
}

export async function POST(request: Request) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

  const session = await auth()

  if (!session?.user?.id || session.user?.role !== "ADMINISTRATOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { name, email, phone } = body

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    return NextResponse.json({ error: "User already exists" }, { status: 400 })
  }

  const tempPassword = generateSecurePassword()
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  const farmer = await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      passwordHash,
      role: "FARMER",
      mustResetPassword: true,
    },
  })

  auditLog({ event: "FARMER_CREATED", adminId: session.user.id, farmerEmail: email })

  return NextResponse.json(
    {
      ...toUserDTO(farmer),
      tempPassword,
    },
    { status: 201 }
  )
}
