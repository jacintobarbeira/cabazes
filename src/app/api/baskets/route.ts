import { prisma } from "@/lib/db"
import { toBasketSummaryDTO, toBasketDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"
import { parseBasketInput, validateDeliveryPoints } from "@/lib/basket-input"

export async function GET(request: Request) {
  const guard = await requireFarmerOrHelper()
  if (!guard.ok) return guard.error

  const baskets = await prisma.basket.findMany({
    where: { farmerId: guard.farmerId },
    include: {
      _count: { select: { orders: true } },
      deliveryPoints: { include: { deliveryPoint: true } },
    },
    orderBy: { orderDeadline: "desc" },
  })

  return NextResponse.json(baskets.map(toBasketSummaryDTO))
}

export const POST = withCsrf(
  async (request: Request): Promise<Response> => {
    const guard = await requireFarmerOrHelper()
    if (!guard.ok) return guard.error

    const body = await request.json()
  const { name, description, orderDeadline, price, deliveryDay, allowedSwaps, deliveryPointIds } = body

  if (!name || !orderDeadline || !price || !deliveryDay) {
    return NextResponse.json(
      { error: "Name, orderDeadline, price, and deliveryDay are required" },
      { status: 400 }
    )
  }

  if (!Array.isArray(deliveryPointIds) || deliveryPointIds.length === 0) {
    return NextResponse.json(
      { error: "At least one delivery point is required" },
      { status: 400 }
    )
  }

  const deliveryPointsCheck = await validateDeliveryPoints(deliveryPointIds, guard.farmerId)
  if (!deliveryPointsCheck.ok) return deliveryPointsCheck.error

  const parsed = parseBasketInput({ name, orderDeadline, price, deliveryDay, allowedSwaps })
  if (!parsed.ok) return parsed.error

  const basket = await prisma.basket.create({
    data: {
      name,
      description: description || null,
      orderDeadline: parsed.value.orderDeadline,
      price: parsed.value.price!,
      deliveryDay: parsed.value.deliveryDay,
      allowedSwaps: parsed.value.allowedSwaps ?? 3,
      farmerId: guard.farmerId,
      deliveryPoints: {
        create: deliveryPointIds.map((deliveryPointId: string) => ({ deliveryPointId })),
      },
    },
    include: {
      items: { include: { product: true } },
      deliveryPoints: { include: { deliveryPoint: true } },
    },
  }).catch(() => null)

  if (!basket) {
    return NextResponse.json(
      { error: "A basket with this name and delivery date already exists" },
      { status: 400 }
    )
  }

  return NextResponse.json(toBasketDTO(basket), { status: 201 })
})
