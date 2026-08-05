import { prisma } from "@/lib/db"
import { toOrderDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getEffectiveFarmerId } from "@/lib/auth-helpers"
import { csrfCheck } from "@/lib/csrf"

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

export async function POST(request: Request) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

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
    include: {
      basket: { include: { items: true } },
      customer: true,
    },
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

  const basketItems = inviteToken.basket.items
  const baseItems = basketItems.filter((i) => i.isBase)
  const swapItems = basketItems.filter((i) => !i.isBase)

  if (swapChoices && swapChoices.length > 0) {
    if (swapChoices.length > inviteToken.basket.allowedSwaps) {
      return NextResponse.json(
        { error: `You can choose at most ${inviteToken.basket.allowedSwaps} swaps` },
        { status: 400 }
      )
    }

    const baseIds = baseItems.map((i) => i.id)
    const swapIds = swapItems.map((i) => i.id)
    const chosenBaseIds = swapChoices.map((c: { baseItemId: string }) => c.baseItemId)
    const chosenSwapIds = swapChoices.map((c: { swapItemId: string }) => c.swapItemId)

    if (chosenBaseIds.some((id: string) => !baseIds.includes(id))) {
      return NextResponse.json(
        { error: "One or more chosen base items are not part of this basket" },
        { status: 400 }
      )
    }

    if (chosenSwapIds.some((id: string) => !swapIds.includes(id))) {
      return NextResponse.json(
        { error: "One or more chosen swap items are not part of this basket" },
        { status: 400 }
      )
    }

    if (new Set(chosenBaseIds).size !== chosenBaseIds.length) {
      return NextResponse.json(
        { error: "Each base item can only be swapped out once" },
        { status: 400 }
      )
    }

    if (new Set(chosenSwapIds).size !== chosenSwapIds.length) {
      return NextResponse.json(
        { error: "Each swap item can only be chosen once" },
        { status: 400 }
      )
    }
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
        swapChoices: swapChoices && swapChoices.length > 0
          ? {
              create: swapChoices.map((choice: { baseItemId: string; swapItemId: string }) => ({
                baseItemId: choice.baseItemId,
                swapItemId: choice.swapItemId,
              })),
            }
          : undefined,
      },
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
