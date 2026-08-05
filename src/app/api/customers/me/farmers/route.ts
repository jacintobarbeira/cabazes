import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { csrfCheck } from "@/lib/csrf"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const farmers = await prisma.customerFarmer.findMany({
    where: { customerId: session.user.id },
    include: { farmer: { select: { id: true, name: true, email: true } } },
    orderBy: { farmer: { name: "asc" } },
  })

  return NextResponse.json(farmers.map((cf) => cf.farmer))
}

export async function POST(request: Request) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

  const session = await auth()

  if (!session?.user?.id || session.user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { farmerId } = body

  if (!farmerId) {
    return NextResponse.json({ error: "farmerId is required" }, { status: 400 })
  }

  const farmer = await prisma.user.findFirst({
    where: { id: farmerId, role: "FARMER" },
  })

  if (!farmer) {
    return NextResponse.json({ error: "Farmer not found" }, { status: 404 })
  }

  const existing = await prisma.customerFarmer.findUnique({
    where: { customerId_farmerId: { customerId: session.user.id, farmerId } },
  })

  if (existing) {
    return NextResponse.json({ error: "Already subscribed to this farmer" }, { status: 400 })
  }

  await prisma.customerFarmer.create({
    data: { customerId: session.user.id, farmerId },
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(request: Request) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

  const session = await auth()

  if (!session?.user?.id || session.user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const farmerId = searchParams.get("farmerId")

  if (!farmerId) {
    return NextResponse.json({ error: "farmerId is required" }, { status: 400 })
  }

  const count = await prisma.customerFarmer.count({
    where: { customerId: session.user.id },
  })

  if (count <= 1) {
    return NextResponse.json(
      { error: "Cannot remove your last farmer. Add another first." },
      { status: 400 }
    )
  }

  const deleted = await prisma.customerFarmer.deleteMany({
    where: { customerId: session.user.id, farmerId },
  })

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
