import { prisma } from "@/lib/db"
import { toDeliveryAddressDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { ORDER_DETAIL_INCLUDE } from "@/lib/prisma-includes"

export async function GET(request: Request) {
  const guard = await requireFarmerOrHelper()
  if (!guard.ok) return guard.error

  const url = new URL(request.url)
  const dateParam = url.searchParams.get("date")

  if (!dateParam) {
    const orders = await prisma.order.findMany({
      where: {
        basket: { farmerId: guard.farmerId },
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

  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1)
  const rawSize = parseInt(url.searchParams.get("pageSize") || "50", 10)
  const pageSize = Math.min(100, Math.max(1, isNaN(rawSize) ? 50 : rawSize))

  const orders = await prisma.order.findMany({
    where: {
      basket: {
        farmerId: guard.farmerId,
        deliveryDay: {
          gte: date,
          lt: nextDate,
        },
      },
      status: { not: "CANCELLED" },
    },
    include: ORDER_DETAIL_INCLUDE,
    orderBy: [{ deliveryCity: "asc" }, { deliveryAddress: "asc" }],
    take: pageSize,
    skip: (page - 1) * pageSize,
  })

  return NextResponse.json(orders.map(toDeliveryAddressDTO))
}
