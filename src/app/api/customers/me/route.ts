import { prisma } from "@/lib/db"
import { toUserDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"

export async function GET() {
  const session = await auth()

  if (!session) {
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
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: body.name,
      phone: body.phone,
      timezone: body.timezone,
      address: body.address,
      city: body.city,
      postalCode: body.postalCode,
      notes: body.notes,
    },
  })

  return NextResponse.json(toUserDTO(user))
}
