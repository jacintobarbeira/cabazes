import { prisma } from "@/lib/db"
import { toFarmerHelperDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import bcrypt from "bcryptjs"
import { generateSecurePassword } from "@/lib/password-policy"
import { auditLog } from "@/lib/audit"
import { csrfCheck } from "@/lib/csrf"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id || session.user?.role !== "FARMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const helpers = await prisma.user.findMany({
    where: { managedById: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(helpers.map(toFarmerHelperDTO))
}

export async function POST(request: Request) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

  const session = await auth()

  if (!session?.user?.id || session.user?.role !== "FARMER") {
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

  const helper = await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      passwordHash,
      role: "FARMER_HELPER",
      managedById: session.user.id,
      mustResetPassword: true,
    },
  })

  auditLog({ event: "HELPER_CREATED", farmerId: session.user.id, helperEmail: email })

  return NextResponse.json(
    {
      ...toFarmerHelperDTO(helper),
      tempPassword,
    },
    { status: 201 }
  )
}
