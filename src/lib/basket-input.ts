import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export type BasketScheduleInput = {
  orderDeadline: Date
  deliveryDay: Date
  price?: number
  allowedSwaps?: number
}

export function parseAllowedSwaps(raw: unknown): number | null {
  const parsed = parseInt(String(raw), 10)
  return isNaN(parsed) || parsed < 0 ? null : parsed
}

export function parseBasketInput(
  body: Record<string, unknown>,
  existing?: { orderDeadline: Date; deliveryDay: Date; price: { toString(): string }; allowedSwaps: number }
):
  | { ok: true; value: BasketScheduleInput }
  | { ok: false; error: NextResponse } {
  const err = (error: string) =>
    ({ ok: false as const, error: NextResponse.json({ error }, { status: 400 }) })

  const orderDeadline = body.orderDeadline ? new Date(String(body.orderDeadline)) : existing?.orderDeadline
  const deliveryDay = body.deliveryDay ? new Date(String(body.deliveryDay)) : existing?.deliveryDay

  if (!orderDeadline || !deliveryDay) {
    return err("orderDeadline and deliveryDay are required")
  }
  if (isNaN(orderDeadline.getTime()) || isNaN(deliveryDay.getTime())) {
    return err("Invalid date format")
  }
  if (orderDeadline >= deliveryDay) {
    return err("Order deadline must be before the delivery date")
  }

  let price: number | undefined
  if (body.price !== undefined) {
    price = parseFloat(String(body.price))
    if (isNaN(price) || price <= 0) {
      return err("Price must be a positive number")
    }
  } else if (!existing) {
    return err("Price must be a positive number")
  }

  let allowedSwaps: number | undefined
  if (body.allowedSwaps !== undefined) {
    const parsed = parseAllowedSwaps(body.allowedSwaps)
    if (parsed === null) {
      return err("allowedSwaps must be a non-negative integer")
    }
    allowedSwaps = parsed
  } else if (!existing) {
    allowedSwaps = 3
  }

  return { ok: true, value: { orderDeadline, deliveryDay, price, allowedSwaps } }
}

export async function validateDeliveryPoints(
  deliveryPointIds: string[],
  farmerId: string
): Promise<{ ok: true } | { ok: false; error: NextResponse }> {
  const deliveryPoints = await prisma.deliveryPoint.findMany({
    where: { id: { in: deliveryPointIds }, farmerId },
    select: { id: true },
  })

  if (deliveryPoints.length !== deliveryPointIds.length) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: "One or more delivery points are not valid for this farmer" },
        { status: 400 }
      ),
    }
  }

  return { ok: true }
}
