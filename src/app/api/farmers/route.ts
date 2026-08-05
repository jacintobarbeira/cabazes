import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const farmers = await prisma.user.findMany({
    where: { role: "FARMER", disabled: false },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(farmers)
}
