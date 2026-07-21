import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getEffectiveFarmerId } from "@/lib/auth-helpers"

export async function POST(
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
  const body = await request.json()
  const { name, maxChoices = 1 } = body

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const basket = await prisma.basket.findFirst({
    where: { id, farmerId },
  })

  if (!basket) {
    return NextResponse.json({ error: "Basket not found" }, { status: 404 })
  }

  const swapGroup = await prisma.swapGroup.create({
    data: {
      basketId: id,
      name,
      maxChoices,
    },
  })

  return NextResponse.json({ id: swapGroup.id, name: swapGroup.name, maxChoices: swapGroup.maxChoices }, { status: 201 })
}

export async function PATCH(request: Request) {
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
  const groupId = searchParams.get("groupId")

  if (!basketId || !groupId) {
    return NextResponse.json({ error: "basketId and groupId are required" }, { status: 400 })
  }

  const body = await request.json()

  const basket = await prisma.basket.findFirst({
    where: { id: basketId, farmerId },
  })

  if (!basket) {
    return NextResponse.json({ error: "Basket not found" }, { status: 404 })
  }

  const updated = await prisma.swapGroup.update({
    where: { id: groupId },
    data: {
      name: body.name,
      maxChoices: body.maxChoices,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(request: Request) {
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
  const groupId = searchParams.get("groupId")

  if (!basketId || !groupId) {
    return NextResponse.json({ error: "basketId and groupId are required" }, { status: 400 })
  }

  const basket = await prisma.basket.findFirst({
    where: { id: basketId, farmerId },
  })

  if (!basket) {
    return NextResponse.json({ error: "Basket not found" }, { status: 404 })
  }

  await prisma.swapGroup.delete({ where: { id: groupId } })

  return NextResponse.json({ success: true })
}
