import { prisma } from "@/lib/db"
import { toProductDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"
import { createProductForFarmer } from "@/lib/product-creation"

export async function GET(request: Request) {
  const guard = await requireFarmerOrHelper()
  if (!guard.ok) return guard.error

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1)
  const rawSize = parseInt(url.searchParams.get("pageSize") || "50", 10)
  const pageSize = Math.min(100, Math.max(1, isNaN(rawSize) ? 50 : rawSize))

  const products = await prisma.product.findMany({
    where: { farmerId: guard.farmerId },
    orderBy: { name: "asc" },
    take: pageSize,
    skip: (page - 1) * pageSize,
  })

  return NextResponse.json(products.map(toProductDTO))
}

export const POST = withCsrf(
  async (request: Request): Promise<Response> => {
    const guard = await requireFarmerOrHelper()
    if (!guard.ok) return guard.error

    const body = await request.json()
    const result = await createProductForFarmer(guard.farmerId, body)

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(toProductDTO(result.product), { status: 201 })
  }
)
