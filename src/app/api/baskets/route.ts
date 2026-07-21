import { prisma } from "@/lib/db"
import { toBasketSummaryDTO, toBasketDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getEffectiveFarmerId } from "@/lib/auth-helpers"

export async function GET(request: Request) {
  const session = await auth()

  if (!session?.user?.id || !["FARMER", "FARMER_HELPER"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const farmerId = await getEffectiveFarmerId()
  if (!farmerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const baskets = await prisma.basket.findMany({
    where: { farmerId },
    include: { _count: { select: { orders: true } } },
    orderBy: { orderDeadline: "desc" },
  })

  return NextResponse.json(baskets.map(toBasketSummaryDTO))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id || !["FARMER", "FARMER_HELPER"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const farmerId = await getEffectiveFarmerId()
  if (!farmerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { name, description, orderDeadline, price, deliveryDay } = body

  if (!name || !orderDeadline || !price || !deliveryDay) {
    return NextResponse.json(
      { error: "Name, orderDeadline, price, and deliveryDay are required" },
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

  const basket = await prisma.basket.create({
    data: {
      name,
      description: description || null,
      orderDeadline: new Date(orderDeadline),
      price: parseFloat(price),
      deliveryDay: new Date(deliveryDay),
      farmerId,
    },
    include: {
      items: { include: { product: true } },
      swapGroups: { include: { items: { include: { product: true } } } },
    },
  }).catch(() => null)

  if (!basket) {
    return NextResponse.json(
      { error: "A basket with this name and delivery date already exists" },
      { status: 400 }
    )
  }

  return NextResponse.json(toBasketDTO(basket), { status: 201 })
}
