import { prisma } from "@/lib/db"
import { toUserDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id || session.user?.role !== "ADMINISTRATOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  const farmer = await prisma.user.findUnique({
    where: { id, role: "FARMER" },
  })

  if (!farmer) {
    return NextResponse.json({ error: "Farmer not found" }, { status: 404 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      name: body.name ?? farmer.name,
      phone: body.phone ?? farmer.phone,
    },
  })

  return NextResponse.json(toUserDTO(updated))
}
