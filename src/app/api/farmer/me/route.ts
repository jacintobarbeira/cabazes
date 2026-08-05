import { prisma } from "@/lib/db"
import { toUserDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { csrfCheck } from "@/lib/csrf"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id || !["FARMER", "FARMER_HELPER"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json(toUserDTO(user))
}

export async function PATCH(request: Request) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

  const session = await auth()

  if (!session?.user?.id || !["FARMER", "FARMER_HELPER"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
    where: { id: session.user.id },
    data: {
      name: body.name,
      phone: body.phone,
      timezone: body.timezone,
      senderEmail: body.senderEmail,
    },
  })

  return NextResponse.json(toUserDTO(user))
}
