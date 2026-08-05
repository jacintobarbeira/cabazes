import { prisma } from "@/lib/db"
import { toUserDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { csrfCheck } from "@/lib/csrf"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
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

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()

  const allowedFields = ["name", "phone", "timezone", "address", "city", "postalCode", "notes"]
  for (const key of Object.keys(body)) {
    if (!allowedFields.includes(key)) {
      return NextResponse.json({ error: `Invalid field: ${key}` }, { status: 400 })
    }
  }

  const stringFields: Record<string, string> = {}
  for (const field of ["name", "phone", "timezone", "address", "city", "postalCode", "notes"]) {
    if (body[field] !== undefined && body[field] !== null) {
      if (typeof body[field] !== "string") {
        return NextResponse.json({ error: `${field} must be a string` }, { status: 400 })
      }
      stringFields[field] = body[field].trim().slice(0, 500)
    }
  }

  if (stringFields.timezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: stringFields.timezone })
    } catch {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 })
    }
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: stringFields.name,
      phone: stringFields.phone,
      timezone: stringFields.timezone,
      address: stringFields.address,
      city: stringFields.city,
      postalCode: stringFields.postalCode,
      notes: stringFields.notes,
    },
  })

  return NextResponse.json(toUserDTO(user))
}
