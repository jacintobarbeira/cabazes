import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData, createTestFarmer, createTestCustomer, createTestDeliveryPoint, TEST_PASSWORDS } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

async function loginAsFarmer(page: any, email: string, password: string) {
  await page.goto("/login")
  await page.waitForLoadState("networkidle")
  await page.fill('input[name="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 })
}

test.describe("Delivery Points", () => {
  test("farmer creates a delivery point and sees it in the list", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    await prisma.$disconnect()

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)

    const res = await page.request.post("/api/delivery-points", {
      data: { name: "Test Delivery Point Create", address: "1 Market St", city: "Testville", postalCode: "00000" },
    })
    expect(res.status()).toBe(201)

    const listRes = await page.request.get("/api/delivery-points")
    expect(listRes.ok()).toBeTruthy()
    const points = await listRes.json()
    expect(points.some((p: { name: string }) => p.name === "Test Delivery Point Create")).toBeTruthy()
  })

  test("delivery points are scoped per farmer", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const otherFarmer = await createTestFarmer(prisma, "dp-other-farmer")
    await createTestDeliveryPoint(prisma, otherFarmer.id, "Test Delivery Point Other")
    await prisma.$disconnect()

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)

    const res = await page.request.get("/api/delivery-points")
    expect(res.ok()).toBeTruthy()
    const points = await res.json()
    expect(points).toHaveLength(0)
  })

  test("basket creation requires at least one delivery point", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    await createTestDeliveryPoint(prisma, farmer.id, "Test Delivery Point Required")
    await prisma.$disconnect()

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const missing = await page.request.post("/api/baskets", {
      data: {
        name: "Test Delivery Points Required Basket",
        orderDeadline: nextWeek.toISOString(),
        price: 20,
        deliveryDay: inTwoWeeks.toISOString(),
      },
    })
    expect(missing.status()).toBe(400)

    const empty = await page.request.post("/api/baskets", {
      data: {
        name: "Test Delivery Points Required Empty Basket",
        orderDeadline: nextWeek.toISOString(),
        price: 20,
        deliveryDay: inTwoWeeks.toISOString(),
        deliveryPointIds: [],
      },
    })
    expect(empty.status()).toBe(400)
  })

  test("basket creation rejects delivery points from another farmer", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const otherFarmer = await createTestFarmer(prisma, "dp-other-farmer-b")
    const otherPoint = await createTestDeliveryPoint(prisma, otherFarmer.id, "Test Delivery Point Other Basket")
    await prisma.$disconnect()

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const res = await page.request.post("/api/baskets", {
      data: {
        name: "Test Delivery Points Cross Basket",
        orderDeadline: nextWeek.toISOString(),
        price: 20,
        deliveryDay: inTwoWeeks.toISOString(),
        deliveryPointIds: [otherPoint.id],
      },
    })
    expect(res.status()).toBe(400)
  })

  test("basket creation with delivery points returns them", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const pointA = await createTestDeliveryPoint(prisma, farmer.id, "Test Delivery Points Basket A")
    const pointB = await createTestDeliveryPoint(prisma, farmer.id, "Test Delivery Points Basket B")
    await prisma.$disconnect()

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const res = await page.request.post("/api/baskets", {
      data: {
        name: "Test Delivery Points Multiple Basket",
        orderDeadline: nextWeek.toISOString(),
        price: 20,
        deliveryDay: inTwoWeeks.toISOString(),
        deliveryPointIds: [pointA.id, pointB.id],
      },
    })
    expect(res.status()).toBe(201)
    const basket = await res.json()
    expect(basket.deliveryPoints).toHaveLength(2)
  })

  test("order placed to a delivery point stores the point and its address", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)
    const point = await createTestDeliveryPoint(prisma, farmer.id, { name: "Test Delivery Points Order Point", address: "5 Corner St", city: "Testville", postalCode: "00001" })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Delivery Points Order Basket",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: inTwoWeeks,
        farmerId: farmer.id,
        published: true,
      },
    })

    await prisma.basketDeliveryPoint.create({
      data: { basketId: basket.id, deliveryPointId: point.id },
    })

    const tokenValue = "test-dp-order-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    const res = await request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryPointId: point.id,
        swapChoices: [],
      },
    })
    expect(res.status()).toBe(201)
    const order = await res.json()

    expect(order.deliveryPointId).toBe(point.id)
    expect(order.deliveryPointName).toBe("Test Delivery Points Order Point")
    expect(order.deliveryAddress).toBe("5 Corner St")
    expect(order.deliveryCity).toBe("Testville")
  })

  test("order placed to customer address stores no delivery point", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)
    const point = await createTestDeliveryPoint(prisma, farmer.id, "Test Delivery Points Customer Order Point")

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Delivery Points Customer Address Basket",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: inTwoWeeks,
        farmerId: farmer.id,
        published: true,
      },
    })

    await prisma.basketDeliveryPoint.create({
      data: { basketId: basket.id, deliveryPointId: point.id },
    })

    const tokenValue = "test-dp-customer-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    const res = await request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryAddress: "789 Customer St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })
    expect(res.status()).toBe(201)
    const order = await res.json()

    expect(order.deliveryPointId).toBeNull()
    expect(order.deliveryPointName).toBeNull()
    expect(order.deliveryAddress).toBe("789 Customer St")
  })

  test("order rejects a delivery point not associated with the basket", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)
    const point = await createTestDeliveryPoint(prisma, farmer.id, "Test Delivery Points Not Associated Point")

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Delivery Points Not Associated Basket",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: inTwoWeeks,
        farmerId: farmer.id,
        published: true,
      },
    })

    const tokenValue = "test-dp-notassoc-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    const res = await request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryPointId: point.id,
        swapChoices: [],
      },
    })
    expect(res.status()).toBe(400)
  })

  test("farmer orders page shows the selected delivery point on the order card", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)
    const point = await createTestDeliveryPoint(prisma, farmer.id, "Test Delivery Points Card Point")

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Delivery Points Card Basket",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: inTwoWeeks,
        farmerId: farmer.id,
        published: true,
      },
    })

    await prisma.basketDeliveryPoint.create({
      data: { basketId: basket.id, deliveryPointId: point.id },
    })

    const tokenValue = "test-dp-card-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    const orderRes = await request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryPointId: point.id,
        swapChoices: [],
      },
    })
    expect(orderRes.ok()).toBeTruthy()

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)
    await page.goto("/farmer/orders")

    await expect(page.getByText("Test Delivery Points Card Point", { exact: true })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Test Delivery Points Card Basket", { exact: true })).toBeVisible()
  })

  test("deliveries by date returns delivery point name and groups by point", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)
    const point = await createTestDeliveryPoint(prisma, farmer.id, "Test Delivery Points Group Point")

    const deliveryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket1 = await prisma.basket.create({
      data: {
        name: "Test Delivery Points Group Basket A",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: deliveryDate,
        farmerId: farmer.id,
        published: true,
      },
    })

    await prisma.basketDeliveryPoint.create({
      data: { basketId: basket1.id, deliveryPointId: point.id },
    })

    const basket2 = await prisma.basket.create({
      data: {
        name: "Test Delivery Points Group Basket B",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: deliveryDate,
        farmerId: farmer.id,
        published: true,
      },
    })

    const token1 = "test-dp-group-token-1-" + Date.now()
    const token2 = "test-dp-group-token-2-" + Date.now()

    await prisma.inviteToken.create({
      data: { customerId: customer.id, basketId: basket1.id, token: token1, expiresAt: nextWeek },
    })
    await prisma.inviteToken.create({
      data: { customerId: customer.id, basketId: basket2.id, token: token2, expiresAt: nextWeek },
    })

    await prisma.$disconnect()

    await request.post("/api/orders", {
      data: { basketId: basket1.id, token: token1, deliveryPointId: point.id, swapChoices: [] },
    })
    await request.post("/api/orders", {
      data: {
        basketId: basket2.id,
        token: token2,
        deliveryAddress: "456 Group St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)

    const dateKey = deliveryDate.toISOString().split("T")[0]
    const ordersRes = await page.request.get(`/api/deliveries/by-date?date=${dateKey}`)
    expect(ordersRes.ok()).toBeTruthy()
    const orders = await ordersRes.json()

    const pointOrder = orders.find((o: { basketName: string }) => o.basketName === "Test Delivery Points Group Basket A")
    expect(pointOrder.deliveryPointName).toBe("Test Delivery Points Group Point")
    const customerOrder = orders.find((o: { basketName: string }) => o.basketName === "Test Delivery Points Group Basket B")
    expect(customerOrder.deliveryPointName).toBeNull()

    await page.goto("/farmer/deliveries")
    await page.locator("text=2 deliveries").first().click()
    await expect(page.getByText("Test Delivery Points Group Point", { exact: true })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Customer delivery", { exact: true })).toBeVisible({ timeout: 5000 })
  })
})
