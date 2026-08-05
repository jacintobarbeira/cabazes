import { prisma } from "@/lib/db"
import { toDeliveryAddressDTO } from "@/lib/mappers"
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

  const url = new URL(request.url)
  const dateParam = url.searchParams.get("date")

  if (!dateParam) {
    const orders = await prisma.order.findMany({
      where: {
        basket: { farmerId },
        status: { not: "CANCELLED" },
      },
      include: { basket: { select: { deliveryDay: true } } },
    })

    const grouped: Record<string, number> = {}
    for (const order of orders) {
      const dateKey = order.basket.deliveryDay.toISOString().split("T")[0]
      grouped[dateKey] = (grouped[dateKey] || 0) + 1
    }

    const result = Object.entries(grouped)
      .map(([date, totalOrders]) => ({ date, totalOrders }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json(result)
  }

  const date = new Date(dateParam)
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + 1)

  const orders = await prisma.order.findMany({
    where: {
      basket: {
        farmerId,
        deliveryDay: {
          gte: date,
          lt: nextDate,
        },
      },
      status: { not: "CANCELLED" },
    },
    include: {
      basket: {
        select: {
          id: true,
          name: true,
          items: { include: { product: true } },
        },
      },
      swapChoices: {
        include: {
          baseItem: { include: { product: true } },
          swapItem: { include: { product: true } },
        },
      },
    },
    orderBy: [{ deliveryCity: "asc" }, { deliveryAddress: "asc" }],
  })

  return NextResponse.json(orders.map(toDeliveryAddressDTO))
}
