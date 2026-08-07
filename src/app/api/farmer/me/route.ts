import { prisma } from "@/lib/db"
import { toUserDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"

export async function GET() {
  const guard = await requireFarmerOrHelper()
  if (!guard.ok) return guard.error

  const user = await prisma.user.findUnique({
    where: { id: guard.user.id },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json(toUserDTO(user))
}

export const PATCH = withCsrf(
  async (request: Request): Promise<Response> => {
    const guard = await requireFarmerOrHelper()
    if (!guard.ok) return guard.error

    const body = await request.json()

    if (body.name && String(body.name).length > 100) {
      return NextResponse.json({ error: "Name is too long" }, { status: 400 })
    }
    if (body.phone && String(body.phone).length > 20) {
      return NextResponse.json({ error: "Phone is too long" }, { status: 400 })
    }
    if (body.senderEmail && String(body.senderEmail).length > 255) {
      return NextResponse.json({ error: "Sender email is too long" }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: guard.user.id },
      data: {
        name: body.name,
        phone: body.phone,
        timezone: body.timezone,
        senderEmail: body.senderEmail,
      },
    })

    return NextResponse.json(toUserDTO(user))
  }
)
