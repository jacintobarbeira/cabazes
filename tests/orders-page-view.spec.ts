import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData, createTestFarmer, createTestCustomer, TEST_PASSWORDS } from "./helpers"

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

test.describe("Orders Page - View Button", () => {
  test("orders page shows View button for each order", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const carrot = await prisma.product.create({
      data: { name: "Test Orders Page Carrot", farmerId: farmer.id, active: true },
    })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Orders Page Basket",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: tomorrow,
        allowedSwaps: 1,
        farmerId: farmer.id,
        published: true,
      },
    })

    await prisma.basketItem.create({
      data: { basketId: basket.id, productId: carrot.id, isBase: true },
    })

    const tokenValue = "test-orders-page-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    await request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)
    await page.goto("/farmer/orders")

    await expect(page.getByRole("button", { name: "View" }).first()).toBeVisible({ timeout: 5000 })
  })

  test("orders page basket link goes to basket detail", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Orders Link Basket",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: tomorrow,
        allowedSwaps: 0,
        farmerId: farmer.id,
        published: true,
      },
    })

    const tokenValue = "test-orders-link-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    await request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryAddress: "456 Oak Ave",
        deliveryCity: "Springfield",
        deliveryPostalCode: "12345",
        swapChoices: [],
      },
    })

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)
    await page.goto("/farmer/orders")

    const basketLink = page.locator(`a[href="/farmer/baskets/${basket.id}"]`).first()
    await expect(basketLink).toBeVisible({ timeout: 5000 })

    await basketLink.click()
    await expect(page).toHaveURL(new RegExp(`/farmer/baskets/${basket.id}$`), { timeout: 5000 })
  })

  test("clicking View expands order details with base items", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const carrot = await prisma.product.create({
      data: { name: "Test Orders Expand Carrot", farmerId: farmer.id, active: true },
    })
    const potato = await prisma.product.create({
      data: { name: "Test Orders Expand Potato", farmerId: farmer.id, active: true },
    })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Orders Expand Basket",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: tomorrow,
        allowedSwaps: 0,
        farmerId: farmer.id,
        published: true,
      },
    })

    await prisma.basketItem.create({
      data: { basketId: basket.id, productId: carrot.id, isBase: true },
    })
    await prisma.basketItem.create({
      data: { basketId: basket.id, productId: potato.id, isBase: true },
    })

    const tokenValue = "test-orders-expand-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    await request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryAddress: "789 Pine Rd",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)
    await page.goto("/farmer/orders")

    await page.getByRole("button", { name: "View" }).first().click()

    await expect(page.getByText("Base Items:")).toBeVisible({ timeout: 3000 })
    await expect(page.getByText("Test Orders Expand Carrot")).toBeVisible()
    await expect(page.getByText("Test Orders Expand Potato")).toBeVisible()
  })

  test("clicking View shows swap choices", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const carrot = await prisma.product.create({
      data: { name: "Test Orders Swap View Carrot", farmerId: farmer.id, active: true },
    })
    const apple = await prisma.product.create({
      data: { name: "Test Orders Swap View Apple", farmerId: farmer.id, active: true },
    })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Orders Swap View Basket",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: tomorrow,
        allowedSwaps: 1,
        farmerId: farmer.id,
        published: true,
      },
    })

    const baseCarrot = await prisma.basketItem.create({
      data: { basketId: basket.id, productId: carrot.id, isBase: true },
    })
    const swapApple = await prisma.basketItem.create({
      data: { basketId: basket.id, productId: apple.id, isBase: false },
    })

    const tokenValue = "test-orders-swap-view-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    await request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryAddress: "100 Swap St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [{ baseItemId: baseCarrot.id, swapItemId: swapApple.id }],
      },
    })

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)
    await page.goto("/farmer/orders")

    await page.getByRole("button", { name: "View" }).first().click()

    await expect(page.getByText("Swap Choices:")).toBeVisible({ timeout: 3000 })
    await expect(page.getByText("Test Orders Swap View Carrot → Test Orders Swap View Apple")).toBeVisible()
  })

  test("clicking Hide collapses the order details", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Orders Collapse Basket",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: tomorrow,
        allowedSwaps: 0,
        farmerId: farmer.id,
        published: true,
      },
    })

    const tokenValue = "test-orders-collapse-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    await request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryAddress: "200 Collapse St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)
    await page.goto("/farmer/orders")

    await page.getByRole("button", { name: "View" }).first().click()
    await expect(page.getByText("Order Details")).toBeVisible({ timeout: 3000 })

    await page.getByRole("button", { name: "Hide" }).first().click()
    await expect(page.getByText("Order Details")).not.toBeVisible()
  })
})
