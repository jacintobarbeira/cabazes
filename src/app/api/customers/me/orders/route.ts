import { prisma } from "@/lib/db"
import { toOrderDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orders = await prisma.order.findMany({
    where: { customerId: session.user.id },
    include: {
      basket: {
        select: {
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
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(orders.map(toOrderDTO))
}
