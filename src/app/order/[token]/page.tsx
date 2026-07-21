import { prisma } from "@/lib/db"
import { toBasketDTO } from "@/lib/mappers"
import { notFound } from "next/navigation"
import OrderForm from "./OrderForm"

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
          swapGroups: { include: { items: { include: { product: true } } } },
        },
      },
      customer: true,
    },
  })

  if (!inviteToken) {
    notFound()
  }

  if (inviteToken.expiresAt < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Link Expired</h1>
          <p className="mt-2 text-gray-600">This order link has expired.</p>
        </div>
      </div>
    )
  }

  if (inviteToken.usedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Order Already Placed</h1>
          <p className="mt-2 text-gray-600">
            This link has already been used. Your order has been submitted.
          </p>
        </div>
      </div>
    )
  }

  if (inviteToken.basket.orderDeadline < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Order Deadline Passed</h1>
          <p className="mt-2 text-gray-600">
            The order deadline for this basket has passed.
          </p>
        </div>
      </div>
    )
  }

  if (!inviteToken.customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Invalid Link</h1>
          <p className="mt-2 text-gray-600">This link is not associated with a customer.</p>
        </div>
      </div>
    )
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

  return <OrderForm basket={basket} customer={customer} token={token} />
}
