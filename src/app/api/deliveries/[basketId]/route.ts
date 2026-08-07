import { prisma } from "@/lib/db"
import { toDeliveryAddressDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ basketId: string }> }
) {
  const guard = await requireFarmerOrHelper()
  if (!guard.ok) return guard.error

  const { basketId } = await params

  const basket = await prisma.basket.findUnique({
    where: { id: basketId, farmerId: guard.farmerId },
    select: { id: true },
  })

  if (!basket) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orders = await prisma.order.findMany({
    where: { basketId, status: { not: "CANCELLED" } },
    include: {
      basket: { select: { id: true, name: true } },
      deliveryPoint: { select: { id: true, name: true } },
    },
    orderBy: [{ deliveryCity: "asc" }, { deliveryAddress: "asc" }],
  })

  return NextResponse.json(orders.map(toDeliveryAddressDTO))
}
