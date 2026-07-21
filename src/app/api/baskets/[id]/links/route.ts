import { prisma } from "@/lib/db"
import { toInviteTokenDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { randomBytes } from "crypto"
import { getEffectiveFarmerId } from "@/lib/auth-helpers"

function generateToken(): string {
  return randomBytes(16).toString("hex")
}

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
  })

  if (!basket) {
    return NextResponse.json({ error: "Basket not found" }, { status: 404 })
  }

  const tokens = await prisma.inviteToken.findMany({
    where: { basketId: id },
    include: {
      basket: { select: { name: true } },
      customer: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(tokens.map(toInviteTokenDTO))
}

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
  const { customerIds }: { customerIds: string[] } = body

  if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
    return NextResponse.json(
      { error: "customerIds array is required" },
      { status: 400 }
    )
  }

  const basket = await prisma.basket.findFirst({
    where: { id, farmerId },
  })

  if (!basket) {
    return NextResponse.json({ error: "Basket not found" }, { status: 404 })
  }

  const expiresAt = new Date(basket.orderDeadline)

  const tokens = []

  for (const customerId of customerIds) {
    const existingToken = await prisma.inviteToken.findFirst({
      where: {
        basketId: id,
        customerId,
        usedAt: null,
        expiresAt: { gte: new Date() },
      },
    })

    if (existingToken) {
      const fullToken = await prisma.inviteToken.findUnique({
        where: { id: existingToken.id },
        include: {
          basket: { select: { name: true } },
          customer: { select: { name: true, email: true } },
        },
      })
      if (fullToken) {
        tokens.push(toInviteTokenDTO(fullToken))
      }
      continue
    }

    const token = generateToken()
    const inviteToken = await prisma.inviteToken.create({
      data: {
        customerId,
        basketId: id,
        token,
        expiresAt,
      },
      include: {
        basket: { select: { name: true } },
        customer: { select: { name: true, email: true } },
      },
    })
    tokens.push(toInviteTokenDTO(inviteToken))
  }

  return NextResponse.json(tokens, { status: 201 })
}
