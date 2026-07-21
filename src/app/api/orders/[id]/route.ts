import { prisma } from "@/lib/db"
import { toOrderDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getEffectiveFarmerId } from "@/lib/auth-helpers"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { status: newStatus } = body

  if (!newStatus) {
    return NextResponse.json({ error: "Status is required" }, { status: 400 })
  }

  const validStatuses = ["PENDING", "CONFIRMED", "DELIVERED", "CANCELLED"]
  if (!validStatuses.includes(newStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { basket: true },
  })

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (["FARMER", "FARMER_HELPER"].includes(session.user.role)) {
    const farmerId = await getEffectiveFarmerId()
    if (!farmerId || order.basket.farmerId !== farmerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (newStatus === "CANCELLED") {
      return NextResponse.json(
        { error: "Farmers cannot cancel orders. Only customers can cancel their own orders." },
        { status: 400 }
      )
    }

    if (order.status === "PENDING" && newStatus === "CONFIRMED") {
      // valid
    } else if (order.status === "CONFIRMED" && newStatus === "DELIVERED") {
      // valid
    } else if (order.status === newStatus) {
      return NextResponse.json(
        { error: `Order is already ${newStatus}` },
        { status: 400 }
      )
    } else {
      return NextResponse.json(
        { error: `Cannot change order from ${order.status} to ${newStatus}` },
        { status: 400 }
      )
    }
  } else if (session.user.role === "CUSTOMER") {
    if (order.customerId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (newStatus !== "CANCELLED" && newStatus !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Customers can only cancel or re-confirm their own orders" },
        { status: 400 }
      )
    }

    if (newStatus === "CANCELLED" && order.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Only confirmed orders can be cancelled" },
        { status: 400 }
      )
    }

    if (newStatus === "CONFIRMED" && order.status !== "CANCELLED") {
      return NextResponse.json(
        { error: "Only cancelled orders can be re-confirmed" },
        { status: 400 }
      )
    }
  } else {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: newStatus },
    include: {
      basket: { select: { name: true } },
      swapChoices: {
        include: {
          swapGroup: { select: { name: true } },
          basketItem: { include: { product: true } },
        },
      },
    },
  })

  return NextResponse.json(toOrderDTO(updated))
}
