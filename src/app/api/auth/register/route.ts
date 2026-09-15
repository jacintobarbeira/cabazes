import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { validatePassword } from "@/lib/password-policy"
import { isRateLimited, recordRateLimitAttempt, rateLimitError } from "@/lib/rate-limiter"
import { auditLog } from "@/lib/audit"
import { csrfCheck } from "@/lib/csrf"
import { hashPassword } from "@/lib/passwords"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

  try {
    const body = await request.json()
    const { name, email, phone, address, city, postalCode, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    if (name && String(name).length > 100) {
      return NextResponse.json({ error: "Name is too long" }, { status: 400 })
    }
    if (phone && String(phone).length > 20) {
      return NextResponse.json({ error: "Phone is too long" }, { status: 400 })
    }

    const rateCheck = await isRateLimited(`register:${normalizedEmail}`)
    if (!rateCheck.allowed) {
      return rateLimitError(rateCheck.retryAfter)
    }

    await recordRateLimitAttempt(`register:${normalizedEmail}`)

    const passwordError = validatePassword(password)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      // Generic response to prevent email enumeration
      return NextResponse.json(
        { error: "Unable to create account. If the email is already registered, please try logging in." },
        { status: 400 }
      )
    }

    const passwordHash = await hashPassword(password)

    const farmerIds: string[] = Array.isArray(body.farmerIds) ? body.farmerIds : []

    if (farmerIds.length === 0) {
      return NextResponse.json(
        { error: "At least one farmer must be selected" },
        { status: 400 }
      )
    }

    const farmers = await prisma.user.findMany({
      where: { id: { in: farmerIds }, role: "FARMER" },
      select: { id: true },
    })

    if (farmers.length !== farmerIds.length) {
      return NextResponse.json(
        { error: "One or more selected farmers are invalid" },
        { status: 400 }
      )
    }

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        phone: phone || null,
        timezone: "UTC",
        address: address || null,
        city: city || null,
        postalCode: postalCode || null,
        role: "CUSTOMER",
        customerFarmers: {
          create: farmers.map((f) => ({ farmerId: f.id })),
        },
      },
    })

    auditLog({ event: "USER_REGISTERED", userId: user.id, email: user.email })

    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name, role: user.role } },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
