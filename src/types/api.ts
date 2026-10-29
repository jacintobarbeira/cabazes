export interface UserDTO {
  id: string
  email: string
  name: string | null
  phone: string | null
  senderEmail: string | null
  role: "FARMER" | "FARMER_HELPER" | "ADMINISTRATOR" | "CUSTOMER"
  timezone: string
  address: string | null
  city: string | null
  postalCode: string | null
  notes: string | null
  disabled: boolean
  mustResetPassword: boolean
  verified: boolean
  managedById: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Farmer email server settings as exposed over the API. The SMTP password is
 * never included — `hasPassword` only says whether one is stored.
 */
export interface EmailServerSettingsDTO {
  configured: boolean
  host: string
  port: number
  secure: boolean
  username: string | null
  hasPassword: boolean
  fromAddress: string | null
  fromName: string | null
}

export interface FarmerHelperDTO {
  id: string
  email: string
  name: string | null
  phone: string | null
  disabled: boolean
  createdAt: string
}

export interface ProductDTO {
  id: string
  name: string
  description: string | null
  category: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface BasketItemDTO {
  id: string
  productId: string
  productName: string
  isBase: boolean
}

export interface DeliveryPointDTO {
  id: string
  name: string
  address: string
  city: string | null
  postalCode: string | null
  createdAt: string
  updatedAt: string
}

export interface AvailableBasketDTO {
  id: string
  name: string
  description: string | null
  price: string
  deliveryDay: string
  orderDeadline: string
  farmerName: string | null
  itemCount: number
}

export interface BasketDTO {
  id: string
  name: string
  description: string | null
  orderDeadline: string
  price: string
  deliveryDay: string
  allowedSwaps: number
  published: boolean
  items: BasketItemDTO[]
  deliveryPoints: DeliveryPointDTO[]
  orderCount?: number
  createdAt: string
  updatedAt: string
}

export interface BasketSummaryDTO {
  id: string
  name: string
  description: string | null
  orderDeadline: string
  price: string
  deliveryDay: string
  allowedSwaps: number
  published: boolean
  orderCount: number
  createdAt: string
}

export interface OrderSwapChoiceDTO {
  id: string
  baseItemId: string
  baseItemName: string
  swapItemId: string
  swapItemName: string
}

export interface OrderDTO {
  id: string
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  basketId: string
  basketName: string
  status: "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED"
  deliveryAddress: string
  deliveryCity: string | null
  deliveryPostalCode: string | null
  deliveryNotes: string | null
  deliveryPointId: string | null
  deliveryPointName: string | null
  baseItems: BasketItemDTO[]
  swapChoices: OrderSwapChoiceDTO[]
  createdAt: string
  updatedAt: string
}

export interface InviteTokenDTO {
  id: string
  basketId: string
  basketName: string
  customerName: string | null
  customerEmail: string | null
  token: string
  expiresAt: string
  usedAt: string | null
  createdAt: string
}

export interface DeliveryAddressDTO {
  address: string
  city: string | null
  postalCode: string | null
  customerName: string | null
  customerPhone: string | null
  deliveryNotes: string | null
  deliveryPointId: string | null
  deliveryPointName: string | null
  basketName: string
  basketId: string
  orderId: string
  status: string
  baseItems: BasketItemDTO[]
  swapChoices: OrderSwapChoiceDTO[]
}

export interface OrderSubmissionDTO {
  basketId: string
  token: string
  customerName: string
  customerEmail: string
  customerPhone: string
  deliveryAddress: string
  deliveryCity?: string
  deliveryPostalCode?: string
  deliveryNotes?: string
  swapChoices: {
    baseItemId: string
    swapItemId: string
  }[]
}
