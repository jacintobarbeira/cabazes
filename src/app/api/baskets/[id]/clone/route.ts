import { prisma } from "@/lib/db"
import { toBasketDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"

export const POST = withCsrf(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<Response> => {
    const guard = await requireFarmerOrHelper()
    if (!guard.ok) return guard.error

    const { id } = await params
    const body = await request.json()
    const { name, orderDeadline, deliveryDay } = body

    if (!name || !orderDeadline || !deliveryDay) {
      return NextResponse.json(
        { error: "name, orderDeadline, and deliveryDay are required" },
        { status: 400 }
      )
    }

    const orderDeadlineDate = new Date(orderDeadline)
    const deliveryDayDate = new Date(deliveryDay)

    if (isNaN(orderDeadlineDate.getTime()) || isNaN(deliveryDayDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
    }

    if (orderDeadlineDate >= deliveryDayDate) {
      return NextResponse.json(
        { error: "Order deadline must be before the delivery date" },
        { status: 400 }
      )
    }

    const source = await prisma.basket.findFirst({
      where: { id, farmerId: guard.farmerId },
      include: {
        items: true,
        deliveryPoints: { select: { deliveryPointId: true } },
      },
    })

    if (!source) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const created = await prisma.$transaction(async (tx) => {
      const basket = await tx.basket.create({
        data: {
          name,
          description: source.description,
          orderDeadline: orderDeadlineDate,
          price: source.price,
          deliveryDay: deliveryDayDate,
          allowedSwaps: source.allowedSwaps,
          farmerId: guard.farmerId,
          published: false,
          deliveryPoints: {
            create: source.deliveryPoints.map((rel) => ({ deliveryPointId: rel.deliveryPointId })),
          },
        },
      })

      for (const item of source.items) {
        await tx.basketItem.create({
          data: {
            basketId: basket.id,
            productId: item.productId,
            isBase: item.isBase,
          },
        })
      }

      return basket
    }).catch(() => null)

    if (!created) {
      return NextResponse.json(
        { error: "A basket with this name and delivery date already exists" },
        { status: 400 }
      )
    }

    const result = await prisma.basket.findUnique({
      where: { id: created.id },
      include: {
        items: { include: { product: true } },
        deliveryPoints: { include: { deliveryPoint: true } },
      },
    })

    return NextResponse.json(toBasketDTO(result!), { status: 201 })
  }
)
