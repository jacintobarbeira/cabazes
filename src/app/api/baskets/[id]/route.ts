import { prisma } from "@/lib/db"
import { toBasketDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getEffectiveFarmerId } from "@/lib/auth-helpers"
import { csrfCheck } from "@/lib/csrf"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id || !["FARMER", "FARMER_HELPER"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const farmerId = await getEffectiveFarmerId()
  if (!farmerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const basket = await prisma.basket.findFirst({
    where: { id, farmerId },
    include: {
      items: { include: { product: true } },
      _count: { select: { orders: true } },
    },
  })

  if (!basket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(toBasketDTO(basket))
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

  const session = await auth()

  if (!session?.user?.id || !["FARMER", "FARMER_HELPER"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const farmerId = await getEffectiveFarmerId()
  if (!farmerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  const basket = await prisma.basket.findFirst({
    where: { id, farmerId },
  })

  if (!basket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (basket.published) {
    return NextResponse.json(
      { error: "Published baskets cannot be edited" },
      { status: 400 }
    )
  }

  const orderDeadlineDate = body.orderDeadline ? new Date(body.orderDeadline) : basket.orderDeadline
  const deliveryDayDate = body.deliveryDay ? new Date(body.deliveryDay) : basket.deliveryDay

  if (isNaN(orderDeadlineDate.getTime()) || isNaN(deliveryDayDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
  }

  if (orderDeadlineDate >= deliveryDayDate) {
    return NextResponse.json(
      { error: "Order deadline must be before the delivery date" },
      { status: 400 }
    )
  }

  let parsedPrice = Number(basket.price)
  if (body.price !== undefined) {
    parsedPrice = parseFloat(body.price)
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 })
    }
  }

  let parsedSwaps = basket.allowedSwaps
  if (body.allowedSwaps !== undefined) {
    parsedSwaps = parseInt(body.allowedSwaps, 10)
    if (isNaN(parsedSwaps) || parsedSwaps < 0) {
      return NextResponse.json(
        { error: "allowedSwaps must be a non-negative integer" },
        { status: 400 }
      )
    }
  }

  const updated = await prisma.basket.update({
    where: { id },
    data: {
      name: body.name ?? basket.name,
      description: body.description,
      orderDeadline: orderDeadlineDate,
      price: parsedPrice,
      deliveryDay: deliveryDayDate,
      allowedSwaps: parsedSwaps,
    },
    include: {
      items: { include: { product: true } },
    },
  }).catch(() => null)

  if (!updated) {
    return NextResponse.json(
      { error: "A basket with this name and delivery date already exists" },
      { status: 400 }
    )
  }

  return NextResponse.json(toBasketDTO(updated))
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

  const session = await auth()

  if (!session?.user?.id || !["FARMER", "FARMER_HELPER"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const farmerId = await getEffectiveFarmerId()
  if (!farmerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const basket = await prisma.basket.findFirst({
    where: { id, farmerId },
  })

  if (!basket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.basket.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
