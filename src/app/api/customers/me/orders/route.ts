import { prisma } from "@/lib/db"
import { toOrderDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth-helpers"
import { ORDER_DETAIL_INCLUDE } from "@/lib/prisma-includes"

export async function GET() {
  const guard = await requireSession()
  if (!guard.ok) return guard.error

  const orders = await prisma.order.findMany({
    where: { customerId: guard.user.id },
    include: ORDER_DETAIL_INCLUDE,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(orders.map(toOrderDTO))
}
