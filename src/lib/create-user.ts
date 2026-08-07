import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { generateSecurePassword } from "@/lib/password-policy"
import { hashPassword } from "@/lib/passwords"

type CreateUserInput = {
  name: string
  email: string
  phone?: string | null
  role: "FARMER" | "FARMER_HELPER"
  managedById?: string
}

export async function createUserWithTempPassword(
  input: CreateUserInput
): Promise<
  | { ok: true; user: Awaited<ReturnType<typeof prisma.user.create>>; tempPassword: string }
  | { ok: false; error: NextResponse }
> {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  })

  if (existingUser) {
    return { ok: false, error: NextResponse.json({ error: "User already exists" }, { status: 400 }) }
  }

  const tempPassword = generateSecurePassword()
  const passwordHash = await hashPassword(tempPassword)

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      passwordHash,
      role: input.role,
      managedById: input.managedById,
      mustResetPassword: true,
    },
  })

  return { ok: true, user, tempPassword }
}
