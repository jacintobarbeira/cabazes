import type {
  UserDTO,
  ProductDTO,
  BasketDTO,
  BasketSummaryDTO,
  OrderDTO,
  InviteTokenDTO,
  DeliveryAddressDTO,
  BasketItemDTO,
  SwapGroupDTO,
  OrderSwapChoiceDTO,
  FarmerHelperDTO,
} from "@/types/api"

export function toUserDTO(user: {
  id: string
  email: string
  name: string | null
  phone: string | null
  role: string
  timezone: string
  address: string | null
  city: string | null
  postalCode: string | null
  notes: string | null
  disabled: boolean
  mustResetPassword: boolean
  managedById: string | null
  createdAt: Date
  updatedAt: Date
}): UserDTO {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role as "FARMER" | "FARMER_HELPER" | "ADMINISTRATOR" | "CUSTOMER",
    timezone: user.timezone,
    address: user.address,
    city: user.city,
    postalCode: user.postalCode,
    notes: user.notes,
    disabled: user.disabled,
    mustResetPassword: user.mustResetPassword,
    managedById: user.managedById,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

export function toFarmerHelperDTO(helper: {
  id: string
  email: string
  name: string | null
  phone: string | null
  disabled: boolean
  createdAt: Date
}): FarmerHelperDTO {
  return {
    id: helper.id,
    email: helper.email,
    name: helper.name,
    phone: helper.phone,
    disabled: helper.disabled,
    createdAt: helper.createdAt.toISOString(),
  }
}

export function toProductDTO(product: {
  id: string
  name: string
  description: string | null
  category: string | null
  unit: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}): ProductDTO {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    unit: product.unit,
    active: product.active,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }
}

function toBasketItemDTO(item: {
  id: string
  productId: string
  product: { name: string }
  quantity: number
  isBase: boolean
  swapGroupId: string | null
}): BasketItemDTO {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.product.name,
    quantity: item.quantity,
    isBase: item.isBase,
    swapGroupId: item.swapGroupId,
  }
}

function toSwapGroupDTO(group: {
  id: string
  name: string | null
  maxChoices: number
  items: {
    id: string
    productId: string
    product: { name: string }
    quantity: number
    isBase: boolean
    swapGroupId: string | null
  }[]
}): SwapGroupDTO {
  return {
    id: group.id,
    name: group.name,
    maxChoices: group.maxChoices,
    items: group.items.map(toBasketItemDTO),
  }
}

export function toBasketDTO(basket: {
  id: string
  name: string
  description: string | null
  orderDeadline: Date
  price: { toString(): string }
  deliveryDay: Date
  published: boolean
  createdAt: Date
  updatedAt: Date
  items: {
    id: string
    productId: string
    product: { name: string }
    quantity: number
    isBase: boolean
    swapGroupId: string | null
  }[]
  swapGroups: {
    id: string
    name: string | null
    maxChoices: number
    items: {
      id: string
      productId: string
      product: { name: string }
      quantity: number
      isBase: boolean
      swapGroupId: string | null
    }[]
  }[]
  _count?: { orders: number }
}): BasketDTO {
  return {
    id: basket.id,
    name: basket.name,
    description: basket.description,
    orderDeadline: basket.orderDeadline.toISOString(),
    price: basket.price.toString(),
    deliveryDay: basket.deliveryDay.toISOString(),
    published: basket.published,
    items: basket.items.map(toBasketItemDTO),
    swapGroups: basket.swapGroups.map(toSwapGroupDTO),
    orderCount: basket._count?.orders,
    createdAt: basket.createdAt.toISOString(),
    updatedAt: basket.updatedAt.toISOString(),
  }
}

export function toBasketSummaryDTO(basket: {
  id: string
  name: string
  description: string | null
  orderDeadline: Date
  price: { toString(): string }
  deliveryDay: Date
  published: boolean
  createdAt: Date
  _count: { orders: number }
}): BasketSummaryDTO {
  return {
    id: basket.id,
    name: basket.name,
    description: basket.description,
    orderDeadline: basket.orderDeadline.toISOString(),
    price: basket.price.toString(),
    deliveryDay: basket.deliveryDay.toISOString(),
    published: basket.published,
    orderCount: basket._count.orders,
    createdAt: basket.createdAt.toISOString(),
  }
}

function toOrderSwapChoiceDTO(choice: {
  id: string
  swapGroup: { name: string | null }
  basketItem: { product: { name: string } }
}): OrderSwapChoiceDTO {
  return {
    id: choice.id,
    swapGroupName: choice.swapGroup.name,
    chosenItemName: choice.basketItem.product.name,
  }
}

export function toOrderDTO(order: {
  id: string
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  basketId: string
  basket: { name: string }
  status: string
  deliveryAddress: string
  deliveryCity: string | null
  deliveryPostalCode: string | null
  deliveryNotes: string | null
  swapChoices: {
    id: string
    swapGroup: { name: string | null }
    basketItem: { product: { name: string } }
  }[]
  createdAt: Date
  updatedAt: Date
}): OrderDTO {
  return {
    id: order.id,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    basketId: order.basketId,
    basketName: order.basket.name,
    status: order.status as "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED",
    deliveryAddress: order.deliveryAddress,
    deliveryCity: order.deliveryCity,
    deliveryPostalCode: order.deliveryPostalCode,
    deliveryNotes: order.deliveryNotes,
    swapChoices: order.swapChoices.map(toOrderSwapChoiceDTO),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  }
}

export function toInviteTokenDTO(token: {
  id: string
  basketId: string
  basket: { name: string }
  customer: { name: string | null; email: string | null } | null
  token: string
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
}): InviteTokenDTO {
  return {
    id: token.id,
    basketId: token.basketId,
    basketName: token.basket.name,
    customerName: token.customer?.name || null,
    customerEmail: token.customer?.email || null,
    token: token.token,
    expiresAt: token.expiresAt.toISOString(),
    usedAt: token.usedAt?.toISOString() || null,
    createdAt: token.createdAt.toISOString(),
  }
}

export function toDeliveryAddressDTO(order: {
  deliveryAddress: string
  deliveryCity: string | null
  deliveryPostalCode: string | null
  customerName: string | null
  customerPhone: string | null
  deliveryNotes: string | null
  basket: { name: string }
  id: string
  status: string
}): DeliveryAddressDTO {
  return {
    address: order.deliveryAddress,
    city: order.deliveryCity,
    postalCode: order.deliveryPostalCode,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryNotes: order.deliveryNotes,
    basketName: order.basket.name,
    orderId: order.id,
    status: order.status,
  }
}
