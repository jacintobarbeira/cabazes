import { prisma } from "@/lib/db"
import { toProductDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"

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
    const { name, description, category, active } = body

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: {
        name,
        description: description || null,
        category: category || null,
        active: active !== false,
        farmerId: guard.farmerId,
      },
    }).catch(() => null)

    if (!product) {
      return NextResponse.json({ error: "A product with this name already exists" }, { status: 400 })
    }

    return NextResponse.json(toProductDTO(product), { status: 201 })
  }
)
