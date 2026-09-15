import { prisma } from "@/lib/db"
import { toCustomerDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"
import { createCustomerForFarmer } from "@/lib/customer-creation"

export async function GET(request: Request) {
  const guard = await requireFarmerOrHelper()
  if (!guard.ok) return guard.error

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1)
  const rawSize = parseInt(url.searchParams.get("pageSize") || "50", 10)
  const pageSize = Math.min(100, Math.max(1, isNaN(rawSize) ? 50 : rawSize))

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
    take: pageSize,
    skip: (page - 1) * pageSize,
  })

  // Both FARMER and FARMER_HELPER use same PII policy; only FARMER gets full PII
  const includePII = guard.user.role === "FARMER"

  return NextResponse.json(customers.map((c) => toCustomerDTO(c, { includePII })))
}

export const POST = withCsrf(
  async (request: Request): Promise<Response> => {
    const guard = await requireFarmerOrHelper()
    if (!guard.ok) return guard.error

    const body = await request.json()
    const result = await createCustomerForFarmer(guard.farmerId, body)

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(toCustomerDTO(result.customer), { status: 201 })
  }
)
