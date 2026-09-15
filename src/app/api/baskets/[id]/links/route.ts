import { prisma } from "@/lib/db"
import { toInviteTokenDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"

function generateToken(): string {
  return randomBytes(16).toString("hex")
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireFarmerOrHelper()
  if (!guard.ok) return guard.error

  const { id } = await params

  const basket = await prisma.basket.findFirst({
    where: { id, farmerId: guard.farmerId },
  })

  if (!basket) {
    return NextResponse.json({ error: "Basket not found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1)
  const rawSize = parseInt(url.searchParams.get("pageSize") || "50", 10)
  const pageSize = Math.min(100, Math.max(1, isNaN(rawSize) ? 50 : rawSize))

  const tokens = await prisma.inviteToken.findMany({
    where: { basketId: id },
    include: {
      basket: { select: { name: true } },
      customer: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: pageSize,
    skip: (page - 1) * pageSize,
  })

  return NextResponse.json(tokens.map(toInviteTokenDTO))
}

export const POST = withCsrf(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<Response> => {
    const guard = await requireFarmerOrHelper()
    if (!guard.ok) return guard.error

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
      where: { id, farmerId: guard.farmerId },
    })

    if (!basket) {
      return NextResponse.json({ error: "Basket not found" }, { status: 404 })
    }

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
    const deadlineMs = new Date(basket.orderDeadline).getTime()
    const expiresAt = new Date(Math.min(deadlineMs, Date.now() + SEVEN_DAYS_MS))

    // Batch fetch existing tokens to avoid N+1
    const existingTokens = await prisma.inviteToken.findMany({
      where: { basketId: id, customerId: { in: customerIds } },
      include: {
        basket: { select: { name: true } },
        customer: { select: { name: true, email: true } },
      },
    })
    const existingByCustomerId = new Map(existingTokens.map((t) => [t.customerId, t]))

    const tokens = []
    const newCustomerIds = customerIds.filter((cid) => !existingByCustomerId.has(cid))

    for (const existing of existingTokens) {
      tokens.push(toInviteTokenDTO(existing))
    }

    for (const customerId of newCustomerIds) {
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
)
