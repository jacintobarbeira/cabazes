import { prisma } from "@/lib/db"
import { toBasketDTO } from "@/lib/mappers"
import { auth } from "@/auth"
import { notFound } from "next/navigation"
import OrderForm from "@/app/order/[token]/OrderForm"
import { OrderErrorState } from "@/components/OrderErrorState"

export default async function BasketOrderPage({
  params,
}: {
  params: Promise<{ basketId: string }>
}) {
  const { basketId } = await params
  const session = await auth()

  const basket = await prisma.basket.findUnique({
    where: { id: basketId },
    include: {
      items: { include: { product: true } },
      deliveryPoints: { include: { deliveryPoint: true } },
    },
  })

  if (!basket) {
    notFound()
  }

  if (!basket.published || basket.orderDeadline < new Date()) {
    return <OrderErrorState type="deadline" />
  }

  const customerUser = await prisma.user.findUnique({
    where: { id: session?.user?.id },
  })

  if (!customerUser) {
    return <OrderErrorState type="invalid" />
  }

  const subscribed = await prisma.customerFarmer.count({
    where: { customerId: customerUser.id, farmerId: basket.farmerId },
  })

  if (subscribed === 0) {
    return <OrderErrorState type="invalid" />
  }

  const existingOrder = await prisma.order.findFirst({
    where: { customerId: customerUser.id, basketId },
  })

  if (existingOrder) {
    return <OrderErrorState type="used" />
  }

  const customer = {
    id: customerUser.id,
    name: customerUser.name || "",
    email: customerUser.email,
    phone: customerUser.phone || "",
    address: customerUser.address || "",
    city: customerUser.city || "",
    postalCode: customerUser.postalCode || "",
    notes: customerUser.notes || "",
  }

  return <OrderForm basket={toBasketDTO(basket)} customer={customer} token="" mode="session" />
}
