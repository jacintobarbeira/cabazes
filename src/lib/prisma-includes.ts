import type { Prisma } from "@prisma/client"

export const BASKET_ITEMS_INCLUDE = {
  items: { include: { product: true } },
} satisfies Prisma.BasketInclude

export const BASKET_DETAIL_INCLUDE = {
  items: { include: { product: true } },
  deliveryPoints: { include: { deliveryPoint: true } },
} satisfies Prisma.BasketInclude

export const INVITE_TOKEN_INCLUDE = {
  basket: { select: { name: true } },
  customer: { select: { name: true, email: true } },
} satisfies Prisma.InviteTokenInclude

export const ORDER_DETAIL_INCLUDE = {
  basket: {
    select: {
      id: true,
      name: true,
      items: { include: { product: true } },
    },
  },
  deliveryPoint: { select: { id: true, name: true } },
  swapChoices: {
    include: {
      baseItem: { include: { product: true } },
      swapItem: { include: { product: true } },
    },
  },
} satisfies Prisma.OrderInclude
