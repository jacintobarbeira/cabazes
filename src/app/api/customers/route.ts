import { prisma } from "@/lib/db"
import { toCustomerDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"
import { auditLog } from "@/lib/audit"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET() {
  const guard = await requireFarmerOrHelper()
  if (!guard.ok) return guard.error

  const customers = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      disabled: false,
      OR: [
        { orders: { some: { basket: { farmerId: guard.farmerId } } } },
        { inviteTokens: { some: { basket: { farmerId: guard.farmerId } } } },
        { customerFarmers: { some: { farmerId: guard.farmerId } } },
      ],
    },
    orderBy: { name: "asc" },
  })

  const includePII = guard.user.role === "FARMER"

  return NextResponse.json(customers.map((c) => toCustomerDTO(c, { includePII })))
}

export const POST = withCsrf(
  async (request: Request): Promise<Response> => {
    const guard = await requireFarmerOrHelper()
    if (!guard.ok) return guard.error

    const body = await request.json()
    const { name, email, phone, address, city, postalCode, notes } = body

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
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

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 })
    }

    const customer = await prisma.user.create({
      data: {
        name: name || null,
        email: normalizedEmail,
        phone: phone || null,
        address: address || null,
        city: city || null,
        postalCode: postalCode || null,
        notes: notes || null,
        timezone: "UTC",
        role: "CUSTOMER",
        verified: false,
        customerFarmers: {
          create: { farmerId: guard.farmerId },
        },
      },
    })

    auditLog({ event: "CUSTOMER_CREATED", farmerId: guard.farmerId, customerId: customer.id, customerEmail: customer.email })

    return NextResponse.json(toCustomerDTO(customer), { status: 201 })
  }
)
