import { prisma } from "@/lib/db"
import { toProductDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"
import { createProductForFarmer } from "@/lib/product-creation"

export async function GET() {
  const guard = await requireFarmerOrHelper()
  if (!guard.ok) return guard.error

  const products = await prisma.product.findMany({
    where: { farmerId: guard.farmerId },
    orderBy: { name: "asc" },
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
