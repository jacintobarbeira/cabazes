import { prisma } from "@/lib/db"
import { toBasketDTO } from "@/lib/mappers"
import { notFound } from "next/navigation"
import OrderForm from "./OrderForm"
import { OrderErrorState } from "@/components/OrderErrorState"

export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const inviteToken = await prisma.inviteToken.findUnique({
    where: { token },
    include: {
      basket: {
        include: {
          items: { include: { product: true } },
          deliveryPoints: { include: { deliveryPoint: true } },
          farmer: { select: { name: true } },
        },
      },
      customer: true,
    },
  })

  if (!inviteToken) {
    notFound()
  }

  if (inviteToken.expiresAt < new Date()) {
    return <OrderErrorState type="expired" />
  }

  if (inviteToken.usedAt) {
    return <OrderErrorState type="used" />
  }

  if (inviteToken.basket.orderDeadline < new Date()) {
    return <OrderErrorState type="deadline" />
  }

  if (!inviteToken.customer) {
    return <OrderErrorState type="invalid" />
  }

  if (inviteToken.customer.disabled) {
    return <OrderErrorState type="deactivated" />
  }

  const basket = toBasketDTO(inviteToken.basket)
  const customer = {
    id: inviteToken.customer.id,
    name: inviteToken.customer.name || "",
    email: inviteToken.customer.email,
    phone: inviteToken.customer.phone || "",
    address: inviteToken.customer.address || "",
    city: inviteToken.customer.city || "",
    postalCode: inviteToken.customer.postalCode || "",
    notes: inviteToken.customer.notes || "",
  }

  return (
    <OrderForm
      basket={basket}
      customer={customer}
      token={token}
      verified={inviteToken.customer.verified}
      farmerName={inviteToken.basket.farmer.name || ""}
    />
  )
}
