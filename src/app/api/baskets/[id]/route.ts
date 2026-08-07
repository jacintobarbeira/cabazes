import { prisma } from "@/lib/db"
import { toBasketDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"
import { parseBasketInput, validateDeliveryPoints } from "@/lib/basket-input"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireFarmerOrHelper()
  if (!guard.ok) return guard.error

  const { id } = await params

  const basket = await prisma.basket.findFirst({
    where: { id, farmerId: guard.farmerId },
    include: {
      items: { include: { product: true } },
      deliveryPoints: { include: { deliveryPoint: true } },
      _count: { select: { orders: true } },
    },
  })

  if (!basket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(toBasketDTO(basket))
}

export const PATCH = withCsrf(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<Response> => {
    const guard = await requireFarmerOrHelper()
    if (!guard.ok) return guard.error

    const { id } = await params
    const body = await request.json()

    const basket = await prisma.basket.findFirst({
      where: { id, farmerId: guard.farmerId },
      include: {
        deliveryPoints: { select: { deliveryPointId: true } },
      },
    })

    if (!basket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (basket.published) {
      return NextResponse.json(
        { error: "Published baskets cannot be edited" },
        { status: 400 }
      )
    }

    let deliveryPointsUpdate: Record<string, unknown> | undefined
    if (body.deliveryPointIds !== undefined) {
      const deliveryPointIds = body.deliveryPointIds as string[]
      if (!Array.isArray(deliveryPointIds)) {
        return NextResponse.json(
          { error: "deliveryPointIds must be an array" },
          { status: 400 }
        )
      }

      const deliveryPointsCheck = await validateDeliveryPoints(deliveryPointIds, guard.farmerId)
      if (!deliveryPointsCheck.ok) return deliveryPointsCheck.error

      const existingIds = new Set(
        (basket.deliveryPoints as { deliveryPointId: string }[]).map((r) => r.deliveryPointId)
      )
      const newIds = new Set(deliveryPointIds)
      const removedIds = [...existingIds].filter((pid) => !newIds.has(pid))

      deliveryPointsUpdate = {
        deleteMany: { deliveryPointId: { in: removedIds } },
        create: deliveryPointIds
          .filter((pid: string) => !existingIds.has(pid))
          .map((deliveryPointId: string) => ({ deliveryPointId })),
      }
    }

    const parsed = parseBasketInput(body, {
      orderDeadline: basket.orderDeadline,
      deliveryDay: basket.deliveryDay,
      price: basket.price,
      allowedSwaps: basket.allowedSwaps,
    })
    if (!parsed.ok) return parsed.error

    const updated = await prisma.basket.update({
      where: { id },
      data: {
        name: body.name ?? basket.name,
        description: body.description,
        orderDeadline: parsed.value.orderDeadline,
        price: parsed.value.price ?? Number(basket.price),
        deliveryDay: parsed.value.deliveryDay,
        allowedSwaps: parsed.value.allowedSwaps ?? basket.allowedSwaps,
        ...(deliveryPointsUpdate ? { deliveryPoints: deliveryPointsUpdate } : {}),
      },
      include: {
        items: { include: { product: true } },
        deliveryPoints: { include: { deliveryPoint: true } },
      },
    }).catch(() => null)

    if (!updated) {
      return NextResponse.json(
        { error: "A basket with this name and delivery date already exists" },
        { status: 400 }
      )
    }

    return NextResponse.json(toBasketDTO(updated))
  }
)

export const DELETE = withCsrf(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<Response> => {
    const guard = await requireFarmerOrHelper()
    if (!guard.ok) return guard.error

    const { id } = await params

    const basket = await prisma.basket.findFirst({
      where: { id, farmerId: guard.farmerId },
    })

    if (!basket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.basket.delete({ where: { id } })

    return NextResponse.json({ success: true })
  }
)
