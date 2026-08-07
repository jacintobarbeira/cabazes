import { prisma } from "@/lib/db"
import { auditLog } from "@/lib/audit"

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type CustomerInput = {
  name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  postalCode?: string | null
  notes?: string | null
}

export async function createCustomerForFarmer(
  farmerId: string,
  input: CustomerInput
): Promise<
  | { ok: true; customer: Awaited<ReturnType<typeof prisma.user.create>> }
  | { ok: false; error: string }
> {
  const email = input.email
  if (!email) {
    return { ok: false, error: "Email is required" }
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return { ok: false, error: "Invalid email format" }
  }

  if (input.name && String(input.name).length > 100) {
    return { ok: false, error: "Name is too long" }
  }
  if (input.phone && String(input.phone).length > 20) {
    return { ok: false, error: "Phone is too long" }
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (existingUser) {
    return { ok: false, error: "User already exists" }
  }

  const customer = await prisma.user.create({
    data: {
      name: input.name || null,
      email: normalizedEmail,
      phone: input.phone || null,
      address: input.address || null,
      city: input.city || null,
      postalCode: input.postalCode || null,
      notes: input.notes || null,
      timezone: "UTC",
      role: "CUSTOMER",
      verified: false,
      customerFarmers: {
        create: { farmerId },
      },
    },
  })

  auditLog({ event: "CUSTOMER_CREATED", farmerId, customerId: customer.id, customerEmail: customer.email })

  return { ok: true, customer }
}
