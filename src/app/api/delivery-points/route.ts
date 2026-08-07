import { prisma } from "@/lib/db"
import { toDeliveryPointDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"

export async function GET() {
  const guard = await requireFarmerOrHelper()
  if (!guard.ok) return guard.error

  const points = await prisma.deliveryPoint.findMany({
    where: { farmerId: guard.farmerId },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(points.map(toDeliveryPointDTO))
}

export const POST = withCsrf(
  async (request: Request): Promise<Response> => {
    const guard = await requireFarmerOrHelper()
    if (!guard.ok) return guard.error

    const body = await request.json()
    const { name, address, city, postalCode } = body

    if (!name || !address) {
      return NextResponse.json(
        { error: "name and address are required" },
        { status: 400 }
      )
    }

    const point = await prisma.deliveryPoint.create({
      data: {
        name,
        address,
        city: city || null,
        postalCode: postalCode || null,
        farmerId: guard.farmerId,
      },
    }).catch(() => null)

    if (!point) {
      return NextResponse.json(
        { error: "A delivery point with this name already exists" },
        { status: 400 }
      )
    }

    return NextResponse.json(toDeliveryPointDTO(point), { status: 201 })
  }
)
