import { prisma } from "@/lib/db"
import { toOrderDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireSession, getEffectiveFarmerId } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"
import { sendDeliveredNotification } from "@/lib/email"
import { ORDER_DETAIL_INCLUDE } from "@/lib/prisma-includes"

export const PATCH = withCsrf(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<Response> => {
    const guard = await requireSession()
    if (!guard.ok) return guard.error

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
    include: { basket: { include: { farmer: { select: { senderEmail: true } } } } },
  })

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (["FARMER", "FARMER_HELPER"].includes(guard.user.role || "")) {
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
  } else if (guard.user.role === "CUSTOMER") {
    if (order.customerId !== guard.user.id) {
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

  const result = await prisma.order.updateMany({
    where: { id, status: order.status },
    data: { status: newStatus },
  })

  if (result.count === 0) {
    return NextResponse.json(
      { error: `Cannot change order from ${order.status} to ${newStatus}` },
      { status: 409 }
    )
  }

  const updated = await prisma.order.findUniqueOrThrow({
    where: { id },
    include: ORDER_DETAIL_INCLUDE,
  })

  if (newStatus === "DELIVERED" && order.customerEmail) {
    sendDeliveredNotification({
      to: order.customerEmail,
      customerName: order.customerName || order.customerEmail,
      basketName: order.basket.name,
      from: order.basket.farmer?.senderEmail || undefined,
    }).catch(() => {})
  }

  return NextResponse.json(toOrderDTO(updated))
})
