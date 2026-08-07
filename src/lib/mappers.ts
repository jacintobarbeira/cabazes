import type {
  UserDTO,
  ProductDTO,
  BasketDTO,
  BasketSummaryDTO,
  OrderDTO,
  InviteTokenDTO,
  DeliveryAddressDTO,
  BasketItemDTO,
  OrderSwapChoiceDTO,
  FarmerHelperDTO,
  DeliveryPointDTO,
  AvailableBasketDTO,
} from "@/types/api"

export function toUserDTO(user: {
  id: string
  email: string
  name: string | null
  phone: string | null
  senderEmail: string | null
  role: string
  timezone: string
  address: string | null
  city: string | null
  postalCode: string | null
  notes: string | null
  disabled: boolean
  mustResetPassword: boolean
  verified: boolean
  managedById: string | null
  createdAt: Date
  updatedAt: Date
}): UserDTO {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    senderEmail: user.senderEmail,
    role: user.role as "FARMER" | "FARMER_HELPER" | "ADMINISTRATOR" | "CUSTOMER",
    timezone: user.timezone,
    address: user.address,
    city: user.city,
    postalCode: user.postalCode,
    notes: user.notes,
    disabled: user.disabled,
    mustResetPassword: user.mustResetPassword,
    verified: user.verified,
    managedById: user.managedById,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}
export function toCustomerDTO(
  customer: {
    id: string
    email: string
    name: string | null
    phone: string | null
    senderEmail: string | null
    role: string
    timezone: string
    address: string | null
    city: string | null
    postalCode: string | null
    notes: string | null
    disabled: boolean
    mustResetPassword: boolean
    verified: boolean
    managedById: string | null
    createdAt: Date
    updatedAt: Date
  },
  options: { includePII?: boolean } = {}
): UserDTO {
  const includePII = options.includePII !== false
  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    senderEmail: customer.senderEmail,
    role: customer.role as "FARMER" | "FARMER_HELPER" | "ADMINISTRATOR" | "CUSTOMER",
    timezone: customer.timezone,
    address: includePII ? customer.address : null,
    city: includePII ? customer.city : null,
    postalCode: includePII ? customer.postalCode : null,
    notes: includePII ? customer.notes : null,
    disabled: customer.disabled,
    mustResetPassword: customer.mustResetPassword,
    verified: customer.verified,
    managedById: customer.managedById,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
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
  active: boolean
  createdAt: Date
  updatedAt: Date
}): ProductDTO {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    active: product.active,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }
}

function toBasketItemDTO(item: {
  id: string
  productId: string
  product: { name: string }
  isBase: boolean
}): BasketItemDTO {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.product.name,
    isBase: item.isBase,
  }
}

export function toDeliveryPointDTO(point: {
  id: string
  name: string
  address: string
  city: string | null
  postalCode: string | null
  createdAt: Date
  updatedAt: Date
}): DeliveryPointDTO {
  return {
    id: point.id,
    name: point.name,
    address: point.address,
    city: point.city,
    postalCode: point.postalCode,
    createdAt: point.createdAt.toISOString(),
    updatedAt: point.updatedAt.toISOString(),
  }
}

export function toAvailableBasketDTO(basket: {
  id: string
  name: string
  description: string | null
  price: { toString(): string }
  deliveryDay: Date
  orderDeadline: Date
  farmer: { name: string | null }
  _count: { items: number }
}): AvailableBasketDTO {
  return {
    id: basket.id,
    name: basket.name,
    description: basket.description,
    price: basket.price.toString(),
    deliveryDay: basket.deliveryDay.toISOString(),
    orderDeadline: basket.orderDeadline.toISOString(),
    farmerName: basket.farmer.name,
    itemCount: basket._count.items,
  }
}

function toBasketDeliveryPointDTO(rel: {
  deliveryPoint: {
    id: string
    name: string
    address: string
    city: string | null
    postalCode: string | null
    createdAt: Date
    updatedAt: Date
  }
}): DeliveryPointDTO {
  return toDeliveryPointDTO(rel.deliveryPoint)
}

export function toBasketDTO(basket: {
  id: string
  name: string
  description: string | null
  orderDeadline: Date
  price: { toString(): string }
  deliveryDay: Date
  allowedSwaps: number
  published: boolean
  createdAt: Date
  updatedAt: Date
  items: {
    id: string
    productId: string
    product: { name: string }
    isBase: boolean
  }[]
  deliveryPoints?: {
    deliveryPoint: {
      id: string
      name: string
      address: string
      city: string | null
      postalCode: string | null
      createdAt: Date
      updatedAt: Date
    }
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
    allowedSwaps: basket.allowedSwaps,
    published: basket.published,
    items: basket.items.map(toBasketItemDTO),
    deliveryPoints: (basket.deliveryPoints ?? []).map(toBasketDeliveryPointDTO),
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
  allowedSwaps: number
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
    allowedSwaps: basket.allowedSwaps,
    published: basket.published,
    orderCount: basket._count.orders,
    createdAt: basket.createdAt.toISOString(),
  }
}

function toOrderSwapChoiceDTO(choice: {
  id: string
  baseItem: { id: string; product: { name: string } }
  swapItem: { id: string; product: { name: string } }
}): OrderSwapChoiceDTO {
  return {
    id: choice.id,
    baseItemId: choice.baseItem.id,
    baseItemName: choice.baseItem.product.name,
    swapItemId: choice.swapItem.id,
    swapItemName: choice.swapItem.product.name,
  }
}

export function toOrderDTO(order: {
  id: string
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  basketId: string
  basket: { name: string; items?: { id: string; productId: string; product: { name: string }; isBase: boolean }[] }
  status: string
  deliveryAddress: string
  deliveryCity: string | null
  deliveryPostalCode: string | null
  deliveryNotes: string | null
  deliveryPointId: string | null
  deliveryPoint?: { id: string; name: string } | null
  swapChoices: {
    id: string
    baseItem: { id: string; product: { name: string } }
    swapItem: { id: string; product: { name: string } }
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
    deliveryPointId: order.deliveryPointId,
    deliveryPointName: order.deliveryPoint?.name || null,
    baseItems: (order.basket.items ?? [])
      .filter((i) => i.isBase)
      .map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product.name,
        isBase: true,
      })),
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
  deliveryPointId: string | null
  deliveryPoint?: { id: string; name: string } | null
  basket: {
    id: string
    name: string
    items?: { id: string; productId: string; product: { name: string }; isBase: boolean }[]
  }
  id: string
  status: string
  swapChoices?: {
    id: string
    baseItem: { id: string; product: { name: string } }
    swapItem: { id: string; product: { name: string } }
  }[]
}): DeliveryAddressDTO {
  return {
    address: order.deliveryAddress,
    city: order.deliveryCity,
    postalCode: order.deliveryPostalCode,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryNotes: order.deliveryNotes,
    deliveryPointId: order.deliveryPointId,
    deliveryPointName: order.deliveryPoint?.name || null,
    basketName: order.basket.name,
    basketId: order.basket.id,
    orderId: order.id,
    status: order.status,
    baseItems: (order.basket.items ?? [])
      .filter((i) => i.isBase)
      .map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product.name,
        isBase: true,
      })),
    swapChoices: (order.swapChoices ?? []).map(toOrderSwapChoiceDTO),
  }
}
