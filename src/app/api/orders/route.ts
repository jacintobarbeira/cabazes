import { prisma } from "@/lib/db"
import { toOrderDTO } from "@/lib/mappers"
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

  const { searchParams } = new URL(request.url)
  const basketId = searchParams.get("basketId")
  const status = searchParams.get("status")

  const where: Record<string, unknown> = {
    basket: {
      farmerId,
    },
  }

  if (basketId) {
    where.basketId = basketId
  }

  if (status) {
    where.status = status
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      basket: { select: { name: true } },
      swapChoices: {
        include: {
          swapGroup: { select: { name: true } },
          basketItem: { include: { product: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(orders.map(toOrderDTO))
}

export async function POST(request: Request) {
  const body = await request.json()
  const {
    basketId,
    token,
    deliveryAddress,
    deliveryCity,
    deliveryPostalCode,
    deliveryNotes,
    swapChoices,
  } = body

  if (!basketId || !token || !deliveryAddress) {
    return NextResponse.json(
      { error: "basketId, token, and deliveryAddress are required" },
      { status: 400 }
    )
  }

  const inviteToken = await prisma.inviteToken.findUnique({
    where: { token },
    include: { basket: true, customer: true },
  })

  if (!inviteToken) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 })
  }

  if (inviteToken.basketId !== basketId) {
    return NextResponse.json({ error: "Token does not match basket" }, { status: 400 })
  }

  if (inviteToken.expiresAt < new Date()) {
    return NextResponse.json({ error: "Token has expired" }, { status: 400 })
  }

  if (inviteToken.usedAt) {
    return NextResponse.json({ error: "Token has already been used" }, { status: 400 })
  }

  if (inviteToken.basket.orderDeadline < new Date()) {
    return NextResponse.json({ error: "Order deadline has passed" }, { status: 400 })
  }

  const customer = inviteToken.customer

  if (!customer) {
    return NextResponse.json({ error: "Token has no associated customer" }, { status: 400 })
  }

  const order = await prisma.$transaction(async (tx) => {
    const existingOrder = await tx.order.findFirst({
      where: { customerId: customer.id, basketId },
    })

    if (existingOrder) {
      throw new Error("You have already placed an order for this basket")
    }

    const createdOrder = await tx.order.create({
      data: {
        basketId,
        inviteTokenId: inviteToken.id,
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        deliveryAddress,
        deliveryCity,
        deliveryPostalCode,
        deliveryNotes,
        swapChoices: swapChoices
          ? {
              create: swapChoices.map((choice: { swapGroupId: string; basketItemId: string }) => ({
                swapGroupId: choice.swapGroupId,
                basketItemId: choice.basketItemId,
              })),
            }
          : undefined,
      },
      include: {
        basket: { select: { name: true } },
        swapChoices: {
          include: {
            swapGroup: { select: { name: true } },
            basketItem: { include: { product: true } },
          },
        },
      },
    }).catch(() => null)

    if (!createdOrder) {
      throw new Error("You have already placed an order for this basket")
    }

    await tx.inviteToken.update({
      where: { id: inviteToken.id },
      data: { usedAt: new Date() },
    })

    return createdOrder
  }).catch((err) => {
    if (err.message === "You have already placed an order for this basket") {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to place order" }, { status: 500 })
  })

  if (!order) {
    return NextResponse.json({ error: "Failed to place order" }, { status: 500 })
  }

  if (order instanceof NextResponse) {
    return order
  }

  return NextResponse.json(toOrderDTO(order), { status: 201 })
}
