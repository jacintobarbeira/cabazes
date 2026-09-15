import { prisma } from "@/lib/db"
import { toOrderDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth-helpers"
import { ORDER_DETAIL_INCLUDE } from "@/lib/prisma-includes"

export async function GET(request: Request) {
  const guard = await requireSession()
  if (!guard.ok) return guard.error

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1)
  const rawSize = parseInt(url.searchParams.get("pageSize") || "50", 10)
  const pageSize = Math.min(100, Math.max(1, isNaN(rawSize) ? 50 : rawSize))

  const orders = await prisma.order.findMany({
    where: { customerId: guard.user.id },
    include: ORDER_DETAIL_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: pageSize,
    skip: (page - 1) * pageSize,
  })

  return NextResponse.json(orders.map(toOrderDTO))
}
