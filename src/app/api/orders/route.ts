import { prisma } from "@/lib/db"
import { toOrderDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getEffectiveFarmerId } from "@/lib/auth-helpers"
import { csrfCheck } from "@/lib/csrf"
import { validatePassword } from "@/lib/password-policy"
import bcrypt from "bcryptjs"

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
      deliveryPoint: { select: { id: true, name: true } },
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
    deliveryPointId,
    swapChoices,
    verifyPassword,
  } = body

  if (!basketId) {
    return NextResponse.json(
      { error: "basketId is required" },
      { status: 400 }
    )
  }

  let basket: {
    id: string
    farmerId: string
    orderDeadline: Date
    allowedSwaps: number
    items: { id: string; isBase: boolean }[]
    deliveryPoints: { deliveryPoint: { id: string; address: string; city: string | null; postalCode: string | null } }[]
  }
  let customer: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    verified: boolean
  }
  let inviteTokenId: string | null = null
  let usedToken: { id: string } | null = null

  if (token) {
    const inviteToken = await prisma.inviteToken.findUnique({
      where: { token },
      include: {
        basket: {
          include: {
            items: true,
            deliveryPoints: { include: { deliveryPoint: true } },
          },
        },
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

    if (!inviteToken.customer) {
      return NextResponse.json({ error: "Token has no associated customer" }, { status: 400 })
    }

    if (inviteToken.customer.disabled) {
      return NextResponse.json({ error: "Account is deactivated" }, { status: 400 })
    }

    basket = inviteToken.basket
    customer = inviteToken.customer
    inviteTokenId = inviteToken.id
    usedToken = { id: inviteToken.id }
  } else {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const found = await prisma.basket.findUnique({
      where: { id: basketId },
      include: {
        items: true,
        deliveryPoints: { include: { deliveryPoint: true } },
      },
    })

    if (!found) {
      return NextResponse.json({ error: "Basket not found" }, { status: 404 })
    }

    if (!found.published) {
      return NextResponse.json({ error: "Basket is not available for ordering" }, { status: 400 })
    }

    if (found.orderDeadline < new Date()) {
      return NextResponse.json({ error: "Order deadline has passed" }, { status: 400 })
    }

    const subscribed = await prisma.customerFarmer.count({
      where: { customerId: session.user.id, farmerId: found.farmerId },
    })

    if (subscribed === 0) {
      return NextResponse.json(
        { error: "You are not subscribed to this basket's farmer" },
        { status: 400 }
      )
    }

    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, phone: true },
    })

    if (!me) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    basket = found
    customer = { ...me, verified: true }
  }

  let verifyHash: string | null = null
  if (verifyPassword) {
    if (customer.verified) {
      return NextResponse.json({ error: "Account is already verified" }, { status: 400 })
    }
    const passwordError = validatePassword(verifyPassword)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }
    verifyHash = await bcrypt.hash(verifyPassword, 10)
  }

  const basketItems = basket.items
  const baseItems = basketItems.filter((i) => i.isBase)
  const swapItems = basketItems.filter((i) => !i.isBase)

  if (swapChoices && swapChoices.length > 0) {
    if (swapChoices.length > basket.allowedSwaps) {
      return NextResponse.json(
        { error: `You can choose at most ${basket.allowedSwaps} swaps` },
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

  let resolvedDelivery: {
    deliveryAddress: string
    deliveryCity: string | null
    deliveryPostalCode: string | null
    deliveryPointId: string | null
  }

  if (deliveryPointId) {
    const basketDeliveryPoint = basket.deliveryPoints.find(
      (rel) => rel.deliveryPoint.id === deliveryPointId
    )

    if (!basketDeliveryPoint) {
      return NextResponse.json(
        { error: "Delivery point is not associated with this basket" },
        { status: 400 }
      )
    }

    const point = basketDeliveryPoint.deliveryPoint
    resolvedDelivery = {
      deliveryAddress: point.address,
      deliveryCity: point.city,
      deliveryPostalCode: point.postalCode,
      deliveryPointId: point.id,
    }
  } else {
    if (!deliveryAddress) {
      return NextResponse.json(
        { error: "deliveryAddress is required when no delivery point is selected" },
        { status: 400 }
      )
    }

    resolvedDelivery = {
      deliveryAddress,
      deliveryCity: deliveryCity || null,
      deliveryPostalCode: deliveryPostalCode || null,
      deliveryPointId: null,
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
        inviteTokenId,
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        deliveryAddress: resolvedDelivery.deliveryAddress,
        deliveryCity: resolvedDelivery.deliveryCity,
        deliveryPostalCode: resolvedDelivery.deliveryPostalCode,
        deliveryNotes: deliveryNotes || null,
        deliveryPointId: resolvedDelivery.deliveryPointId,
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
        deliveryPoint: { select: { id: true, name: true } },
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

    if (usedToken) {
      await tx.inviteToken.update({
        where: { id: usedToken.id },
        data: { usedAt: new Date() },
      })
    }

    if (verifyHash) {
      await tx.user.update({
        where: { id: customer.id },
        data: { passwordHash: verifyHash, verified: true },
      })
    }

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
