import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"
import { buildEmailSettings, getEmailTransport, sendOrderLink } from "@/lib/email"

export const POST = withCsrf(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<Response> => {
    const guard = await requireFarmerOrHelper()
    if (!guard.ok) return guard.error

    const farmer = await prisma.user.findUnique({
      where: { id: guard.farmerId },
      select: { senderEmail: true, emailServerConfig: true },
    })

    const settings = farmer ? buildEmailSettings(farmer) : null

    if (!settings && getEmailTransport() === "smtp") {
      return NextResponse.json(
        { error: "Email server is not configured. Set it up in Farmer Settings." },
        { status: 400 }
      )
    }

    const { id } = await params

    const basket = await prisma.basket.findUnique({
      where: { id, farmerId: guard.farmerId },
    })

    if (!basket) {
      return NextResponse.json({ error: "Basket not found" }, { status: 404 })
    }

    const body = await request.json()
    const { tokenIds }: { tokenIds: string[] } = body

    if (!tokenIds || !Array.isArray(tokenIds) || tokenIds.length === 0) {
      return NextResponse.json({ error: "tokenIds array is required" }, { status: 400 })
    }

    const tokens = await prisma.inviteToken.findMany({
      where: {
        id: { in: tokenIds },
        basketId: id,
        usedAt: null,
      },
      include: { customer: true },
    })

    if (tokens.length === 0) {
      return NextResponse.json({ error: "No active tokens found" }, { status: 404 })
    }

    const origin = process.env.NEXTAUTH_URL
    if (!origin) {
      return NextResponse.json({ error: "Server misconfigured: NEXTAUTH_URL not set" }, { status: 500 })
    }
    const results: { tokenId: string; email: string; sent: boolean; error?: string }[] = []

    for (const token of tokens) {
      try {
        await sendOrderLink({
          to: token.customer.email,
          customerName: token.customer.name || token.customer.email,
          basketName: basket.name,
          link: `${origin}/order/${token.token}`,
          from: farmer?.senderEmail || undefined,
          settings,
        })
        results.push({ tokenId: token.id, email: token.customer.email, sent: true })
      } catch (err) {
        console.error("[send-email] failed for token", token.id, err)
        results.push({ tokenId: token.id, email: token.customer.email, sent: false, error: "Failed to send email" })
      }
    }

    return NextResponse.json({ results })
  }
)
