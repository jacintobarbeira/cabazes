import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

async function loginAsFarmer(page: any) {
  await page.goto("/login")
  await page.fill('input[name="email"]', "farmer@cabazes.com")
  await page.fill('input[type="password"]', "Farmer123!")
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 })
}

test.describe("Deliveries Page - View Order Button", () => {
  test("deliveries page shows View Order button for each delivery", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await prisma.user.findUnique({ where: { email: "farmer@cabazes.com" } })
    const customer = await prisma.user.findUnique({ where: { email: "alice@example.com" } })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const deliveryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Deliveries View Basket",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: deliveryDate,
        farmerId: farmer!.id,
        published: true,
      },
    })

    const tokenValue = "test-deliveries-view-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer!.id,
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
        deliveryAddress: "123 View St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await loginAsFarmer(page)
    await page.goto("/farmer/deliveries")
    await page.locator("text=1 deliveries").first().click()
    await expect(page.getByRole("button", { name: "View Order" }).first()).toBeVisible({ timeout: 5000 })
  })

  test("deliveries page basket link goes to basket detail", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await prisma.user.findUnique({ where: { email: "farmer@cabazes.com" } })
    const customer = await prisma.user.findUnique({ where: { email: "alice@example.com" } })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const deliveryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Deliveries Link2 Basket",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: deliveryDate,
        farmerId: farmer!.id,
        published: true,
      },
    })

    const tokenValue = "test-deliveries-link2-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer!.id,
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
        deliveryAddress: "456 Link St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await loginAsFarmer(page)
    await page.goto("/farmer/deliveries")

    await expect(page.locator("text=1 deliveries").first()).toBeVisible({ timeout: 5000 })
    await page.locator("text=1 deliveries").first().click()

    await expect(page.getByRole("button", { name: "View Order" }).first()).toBeVisible({ timeout: 5000 })

    const basketLink = page.locator(`a[href="/farmer/baskets/${basket.id}"]`).first()
    await expect(basketLink).toBeVisible({ timeout: 5000 })

    await basketLink.click()
    await expect(page).toHaveURL(new RegExp(`/farmer/baskets/${basket.id}$`), { timeout: 5000 })
  })

  test("clicking View Order expands order details with base items", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await prisma.user.findUnique({ where: { email: "farmer@cabazes.com" } })
    const customer = await prisma.user.findUnique({ where: { email: "alice@example.com" } })

    const carrot = await prisma.product.create({
      data: { name: "Test Deliveries Expand Carrot", farmerId: farmer!.id, active: true },
    })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const deliveryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Deliveries Expand Basket",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: deliveryDate,
        farmerId: farmer!.id,
        published: true,
      },
    })

    await prisma.basketItem.create({
      data: { basketId: basket.id, productId: carrot.id, isBase: true },
    })

    const tokenValue = "test-deliveries-expand-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer!.id,
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
        deliveryAddress: "789 Expand St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await loginAsFarmer(page)
    await page.goto("/farmer/deliveries")

    await expect(page.locator("text=1 deliveries").first()).toBeVisible({ timeout: 5000 })
    await page.locator("text=1 deliveries").first().click()

    await expect(page.getByRole("button", { name: "View Order" }).first()).toBeVisible({ timeout: 5000 })
    await page.getByRole("button", { name: "View Order" }).first().click()

    await expect(page.getByText("Base Items:")).toBeVisible({ timeout: 3000 })
    await expect(page.getByText("Test Deliveries Expand Carrot")).toBeVisible()
  })

  test("clicking View Order shows swap choices", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await prisma.user.findUnique({ where: { email: "farmer@cabazes.com" } })
    const customer = await prisma.user.findUnique({ where: { email: "alice@example.com" } })

    const carrot = await prisma.product.create({
      data: { name: "Test Deliveries SwapView Carrot", farmerId: farmer!.id, active: true },
    })
    const apple = await prisma.product.create({
      data: { name: "Test Deliveries SwapView Apple", farmerId: farmer!.id, active: true },
    })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const deliveryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Deliveries SwapView Basket",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: deliveryDate,
        allowedSwaps: 1,
        farmerId: farmer!.id,
        published: true,
      },
    })

    const baseCarrot = await prisma.basketItem.create({
      data: { basketId: basket.id, productId: carrot.id, isBase: true },
    })
    const swapApple = await prisma.basketItem.create({
      data: { basketId: basket.id, productId: apple.id, isBase: false },
    })

    const tokenValue = "test-deliveries-swapview-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer!.id,
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
        deliveryAddress: "100 SwapView St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [{ baseItemId: baseCarrot.id, swapItemId: swapApple.id }],
      },
    })

    await loginAsFarmer(page)
    await page.goto("/farmer/deliveries")

    await expect(page.locator("text=1 deliveries").first()).toBeVisible({ timeout: 5000 })
    await page.locator("text=1 deliveries").first().click()

    await expect(page.getByRole("button", { name: "View Order" }).first()).toBeVisible({ timeout: 5000 })
    await page.getByRole("button", { name: "View Order" }).first().click()

    await expect(page.getByText("Swap Choices:")).toBeVisible({ timeout: 3000 })
    await expect(page.getByText("Test Deliveries SwapView Carrot → Test Deliveries SwapView Apple")).toBeVisible()
  })

  test("clicking Hide collapses the order details", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await prisma.user.findUnique({ where: { email: "farmer@cabazes.com" } })
    const customer = await prisma.user.findUnique({ where: { email: "alice@example.com" } })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const deliveryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Deliveries Collapse Basket",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: deliveryDate,
        farmerId: farmer!.id,
        published: true,
      },
    })

    const tokenValue = "test-deliveries-collapse-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer!.id,
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

    await loginAsFarmer(page)
    await page.goto("/farmer/deliveries")
    await page.locator("text=1 deliveries").first().click()

    await expect(page.getByRole("button", { name: "View Order" }).first()).toBeVisible({ timeout: 5000 })
    await page.getByRole("button", { name: "View Order" }).first().click()
    await expect(page.getByText("Order Details")).toBeVisible({ timeout: 3000 })

    await page.getByRole("button", { name: "Hide" }).first().click()
    await expect(page.getByText("Order Details")).not.toBeVisible()
  })
})
