import { prisma } from "@/lib/db"
import { toBasketDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getEffectiveFarmerId } from "@/lib/auth-helpers"
import { csrfCheck } from "@/lib/csrf"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

  const session = await auth()

  if (!session?.user?.id || !["FARMER", "FARMER_HELPER"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const farmerId = await getEffectiveFarmerId()
  if (!farmerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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

  if (orderDeadlineDate >= deliveryDayDate) {
    return NextResponse.json(
      { error: "Order deadline must be before the delivery date" },
      { status: 400 }
    )
  }

  const source = await prisma.basket.findFirst({
    where: { id, farmerId },
    include: {
      items: true,
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
        farmerId,
        published: false,
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
    },
  })

  return NextResponse.json(toBasketDTO(result!), { status: 201 })
}
