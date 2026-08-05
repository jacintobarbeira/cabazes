import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { validatePassword } from "@/lib/password-policy"
import { isRateLimited, recordRateLimitAttempt } from "@/lib/rate-limiter"
import { auditLog } from "@/lib/audit"
import { csrfCheck } from "@/lib/csrf"

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

    const rateCheck = isRateLimited(`register:${normalizedEmail}`)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${rateCheck.retryAfter} seconds.` },
        { status: 429 }
      )
    }

    recordRateLimitAttempt(`register:${normalizedEmail}`)

    const passwordError = validatePassword(password)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 10)

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
