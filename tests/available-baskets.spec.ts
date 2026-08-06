import { test, expect } from "@playwright/test"
import {
  createPrisma,
  cleanupTestData,
  createTestFarmer,
  createTestCustomer,
  createTestDeliveryPoint,
  subscribeCustomer,
  TEST_PASSWORDS,
} from "./helpers"

const CUSTOMER = "test-available-customer"
const FARMER = "test-available-farmer"
const FARMER_B = "test-available-farmer-b"
const CUSTOMER_EMAIL = `${CUSTOMER}@example.com`

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

async function loginAsCustomer(page: any) {
  await page.goto("/login")
  await page.waitForLoadState("networkidle")
  await page.fill('input[name="email"]', CUSTOMER_EMAIL)
  await page.fill('input[type="password"]', TEST_PASSWORDS.customer)
  await page.click('button[type="submit"]')
  await page.waitForURL(/.*my-orders|.*baskets/, { timeout: 10000 })
}

async function createPublishedBasket(
  prisma: any,
  farmerId: string,
  name: string,
  opts?: { orderDeadline?: Date; deliveryDay?: Date; published?: boolean }
) {
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  return prisma.basket.create({
    data: {
      name,
      orderDeadline: opts?.orderDeadline || nextWeek,
      price: 25.0,
      deliveryDay: opts?.deliveryDay || inTwoWeeks,
      farmerId,
      published: opts?.published !== false,
    },
  })
}

async function placeSessionOrder(page: any, basketId: string) {
  const res = await page.request.post("/api/orders", {
    data: {
      basketId,
      deliveryAddress: "123 Test St",
      deliveryCity: "Testville",
      deliveryPostalCode: "00000",
      swapChoices: [],
    },
  })
  return res
}

test.describe("Available Baskets", () => {
  test("customer sees published baskets from subscribed farmers", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createTestCustomer(prisma, CUSTOMER)
    await subscribeCustomer(prisma, customer.id, farmer.id)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Available List Basket")
    await prisma.$disconnect()

    await loginAsCustomer(page)

    const res = await page.request.get("/api/customers/me/available-baskets")
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.subscribedFarmerCount).toBe(1)
    const found = data.baskets.find((b: { id: string }) => b.id === basket.id)
    expect(found).toBeTruthy()
    expect(found.name).toBe("Test Available List Basket")
    expect(found.farmerName).toBe("Test Farmer")
    expect(found.itemCount).toBe(0)
  })

  test("unpublished baskets are excluded", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createTestCustomer(prisma, CUSTOMER)
    await subscribeCustomer(prisma, customer.id, farmer.id)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Available Unpublished Basket", {
      published: false,
    })
    await prisma.$disconnect()

    await loginAsCustomer(page)

    const res = await page.request.get("/api/customers/me/available-baskets")
    const data = await res.json()
    expect(data.baskets.some((b: { id: string }) => b.id === basket.id)).toBeFalsy()
  })

  test("baskets from unsubscribed farmers are excluded", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const otherFarmer = await createTestFarmer(prisma, FARMER_B)
    const customer = await createTestCustomer(prisma, CUSTOMER)
    await subscribeCustomer(prisma, customer.id, farmer.id)
    const basket = await createPublishedBasket(prisma, otherFarmer.id, "Test Available Unsubscribed Basket")
    await prisma.$disconnect()

    await loginAsCustomer(page)

    const res = await page.request.get("/api/customers/me/available-baskets")
    const data = await res.json()
    expect(data.baskets.some((b: { id: string }) => b.id === basket.id)).toBeFalsy()
  })

  test("baskets with passed order deadline are excluded", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createTestCustomer(prisma, CUSTOMER)
    await subscribeCustomer(prisma, customer.id, farmer.id)
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Available Deadline Basket", {
      orderDeadline: past,
    })
    await prisma.$disconnect()

    await loginAsCustomer(page)

    const res = await page.request.get("/api/customers/me/available-baskets")
    const data = await res.json()
    expect(data.baskets.some((b: { id: string }) => b.id === basket.id)).toBeFalsy()
  })

  test("baskets the customer already ordered are excluded", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createTestCustomer(prisma, CUSTOMER)
    await subscribeCustomer(prisma, customer.id, farmer.id)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Available Ordered Basket")

    const tokenValue = "test-av-ordered-token-" + Date.now()
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await prisma.inviteToken.create({
      data: { customerId: customer.id, basketId: basket.id, token: tokenValue, expiresAt: nextWeek },
    })
    await prisma.$disconnect()

    const orderRes = await page.request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryAddress: "123 Test St",
        swapChoices: [],
      },
    })
    expect(orderRes.status()).toBe(201)

    await loginAsCustomer(page)

    const res = await page.request.get("/api/customers/me/available-baskets")
    const data = await res.json()
    expect(data.baskets.some((b: { id: string }) => b.id === basket.id)).toBeFalsy()
  })

  test("available baskets endpoint requires a customer session", async ({ request }) => {
    const res = await request.get("/api/customers/me/available-baskets", { maxRedirects: 0 })
    expect(res.status()).toBe(307)
  })

  test("customer places an order without a token", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createTestCustomer(prisma, CUSTOMER)
    await subscribeCustomer(prisma, customer.id, farmer.id)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Available Session Order Basket")
    await prisma.$disconnect()

    await loginAsCustomer(page)

    const res = await placeSessionOrder(page, basket.id)
    expect(res.status()).toBe(201)

    const prisma2 = createPrisma()
    const order = await prisma2.order.findFirst({
      where: { basketId: basket.id, customerId: customer.id },
    })
    expect(order).toBeTruthy()
    expect(order!.inviteTokenId).toBeNull()
    expect(order!.deliveryAddress).toBe("123 Test St")
    const tokenCount = await prisma2.inviteToken.count({ where: { basketId: basket.id } })
    expect(tokenCount).toBe(0)
    await prisma2.$disconnect()
  })

  test("customer places a session order to a delivery point", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createTestCustomer(prisma, CUSTOMER)
    await subscribeCustomer(prisma, customer.id, farmer.id)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Available Session Point Basket")
    const point = await createTestDeliveryPoint(prisma, farmer.id, {
      name: "Test Available Session Point",
      address: "1 Market St",
      city: "Testville",
      postalCode: "00000",
    })
    await prisma.basketDeliveryPoint.create({
      data: { basketId: basket.id, deliveryPointId: point.id },
    })
    await prisma.$disconnect()

    await loginAsCustomer(page)

    const res = await page.request.post("/api/orders", {
      data: { basketId: basket.id, deliveryPointId: point.id, swapChoices: [] },
    })
    expect(res.status()).toBe(201)
    const order = await res.json()
    expect(order.deliveryPointId).toBe(point.id)
    expect(order.deliveryAddress).toBe("1 Market St")
  })

  test("customer cannot order from an unsubscribed farmer", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    await createTestCustomer(prisma, CUSTOMER)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Available Unsubscribed Order Basket")
    await prisma.$disconnect()

    await loginAsCustomer(page)

    const res = await placeSessionOrder(page, basket.id)
    expect(res.status()).toBe(400)
  })

  test("customer cannot order the same basket twice", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createTestCustomer(prisma, CUSTOMER)
    await subscribeCustomer(prisma, customer.id, farmer.id)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Available Duplicate Session Basket")
    await prisma.$disconnect()

    await loginAsCustomer(page)

    const first = await placeSessionOrder(page, basket.id)
    expect(first.status()).toBe(201)

    const second = await placeSessionOrder(page, basket.id)
    expect(second.status()).toBe(400)
  })

  test("customer cannot order an unpublished basket", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createTestCustomer(prisma, CUSTOMER)
    await subscribeCustomer(prisma, customer.id, farmer.id)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Available Unpublished Order Basket", {
      published: false,
    })
    await prisma.$disconnect()

    await loginAsCustomer(page)

    const res = await placeSessionOrder(page, basket.id)
    expect(res.status()).toBe(400)
  })

  test("customer orders without a token require authentication", async ({ request }) => {
    const res = await request.post("/api/orders", {
      data: {
        basketId: "nonexistent",
        deliveryAddress: "123 Test St",
        swapChoices: [],
      },
    })
    expect(res.status()).toBe(401)
  })

  test("baskets page shows available baskets and order flow works", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createTestCustomer(prisma, CUSTOMER)
    await subscribeCustomer(prisma, customer.id, farmer.id)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Available UI Basket")
    await prisma.$disconnect()

    await loginAsCustomer(page)
    await page.goto("/baskets")

    await expect(page.getByText("Test Available UI Basket", { exact: true })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Test Farmer", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Order" }).click()
    await page.waitForURL(new RegExp(`/baskets/${basket.id}`))
    await page.getByRole("button", { name: "Place Order" }).click()

    await expect(page.getByText("Order Placed!", { exact: true })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole("button", { name: "Back to available baskets" })).toBeVisible()
  })

  test("baskets page shows empty state when no baskets are available", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createTestCustomer(prisma, CUSTOMER)
    await subscribeCustomer(prisma, customer.id, farmer.id)
    await createPublishedBasket(prisma, farmer.id, "Test Available Empty State Basket", {
      published: false,
    })
    await prisma.$disconnect()

    await loginAsCustomer(page)
    await page.goto("/baskets")

    await expect(page.getByText("No baskets available right now. Check back later for new baskets from your farmers!", { exact: true })).toBeVisible({ timeout: 5000 })
  })

  test("baskets page guides customers with no farmer subscriptions", async ({ page }) => {
    const prisma = createPrisma()
    await createTestCustomer(prisma, CUSTOMER)
    await prisma.$disconnect()

    await loginAsCustomer(page)
    await page.goto("/baskets")

    await expect(
      page.getByText("You are not subscribed to any farmers yet. Subscribe to a farmer to order from them.", { exact: true })
    ).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole("link", { name: "Manage Farmers" })).toBeVisible()
  })

  test("basket order page blocks an already ordered basket", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createTestCustomer(prisma, CUSTOMER)
    await subscribeCustomer(prisma, customer.id, farmer.id)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Available Used Page Basket")
    await prisma.$disconnect()

    await loginAsCustomer(page)
    await placeSessionOrder(page, basket.id)

    await page.goto(`/baskets/${basket.id}`)
    await expect(page.getByText("Order Already Placed", { exact: true })).toBeVisible({ timeout: 5000 })
  })
})
