import { prisma } from "@/lib/db"
import { toUserDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { auditLog } from "@/lib/audit"
import { withCsrf } from "@/lib/csrf"
import { createUserWithTempPassword } from "@/lib/create-user"

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.error

  const farmers = await prisma.user.findMany({
    where: { role: "FARMER" },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(farmers.map(toUserDTO))
}

export const POST = withCsrf(
  async (request: Request): Promise<Response> => {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.error

    const body = await request.json()
    const { name, email, phone } = body

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const result = await createUserWithTempPassword({
      name,
      email,
      phone,
      role: "FARMER",
    })

    if (!result.ok) return result.error

    auditLog({ event: "FARMER_CREATED", adminId: guard.user.id, farmerEmail: email })

    // tempPassword is not returned in response to avoid exposure in logs/history;
    // it should be delivered via secure email channel if needed
    return NextResponse.json(toUserDTO(result.user), { status: 201 })
  }
)
