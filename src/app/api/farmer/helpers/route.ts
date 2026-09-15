import { prisma } from "@/lib/db"
import { toFarmerHelperDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireFarmer } from "@/lib/auth-helpers"
import { auditLog } from "@/lib/audit"
import { withCsrf } from "@/lib/csrf"
import { createUserWithTempPassword } from "@/lib/create-user"

export async function GET() {
  const guard = await requireFarmer()
  if (!guard.ok) return guard.error

  const helpers = await prisma.user.findMany({
    where: { managedById: guard.user.id },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(helpers.map(toFarmerHelperDTO))
}

export const POST = withCsrf(
  async (request: Request): Promise<Response> => {
    const guard = await requireFarmer()
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
      role: "FARMER_HELPER",
      managedById: guard.user.id,
    })

    if (!result.ok) return result.error

    auditLog({ event: "HELPER_CREATED", farmerId: guard.user.id, helperEmail: email })

    // tempPassword omitted from response for security; deliver via email only
    return NextResponse.json(toFarmerHelperDTO(result.user), { status: 201 })
  }
)
