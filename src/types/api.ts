export interface UserDTO {
  id: string
  email: string
  name: string | null
  phone: string | null
  role: "FARMER" | "FARMER_HELPER" | "ADMINISTRATOR" | "CUSTOMER"
  timezone: string
  address: string | null
  city: string | null
  postalCode: string | null
  notes: string | null
  disabled: boolean
  mustResetPassword: boolean
  managedById: string | null
  createdAt: string
  updatedAt: string
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
  unit: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface BasketItemDTO {
  id: string
  productId: string
  productName: string
  quantity: number
  isBase: boolean
  swapGroupId: string | null
}

export interface SwapGroupDTO {
  id: string
  name: string | null
  maxChoices: number
  items: BasketItemDTO[]
}

export interface BasketDTO {
  id: string
  name: string
  description: string | null
  orderDeadline: string
  price: string
  deliveryDay: string
  published: boolean
  items: BasketItemDTO[]
  swapGroups: SwapGroupDTO[]
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
  published: boolean
  orderCount: number
  createdAt: string
}

export interface OrderSwapChoiceDTO {
  id: string
  swapGroupName: string | null
  chosenItemName: string
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
  basketName: string
  orderId: string
  status: string
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
    swapGroupId: string
    basketItemId: string
  }[]
}
