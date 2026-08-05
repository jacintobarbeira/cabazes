import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData } from "./helpers"

test.describe("Client-Side Constraint Checks", () => {
  test.beforeEach(async () => {
    await cleanupTestData()
  })

  test.afterEach(async () => {
    await cleanupTestData()
  })

  test("should disable basket create button when deadline is after delivery day", async ({ page }) => {
    await page.goto("/login")
    await page.fill('input[name="email"]', "farmer@cabazes.com")
    await page.fill('input[type="password"]', "Farmer123!")
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 })

    await page.goto("/farmer/baskets/new")
    await page.fill('input[placeholder="e.g. Summer Basket"]', "Test Basket")
    await page.locator('input[type="number"]').nth(0).fill("20")

    const inputs = await page.locator('input[type="datetime-local"], input[type="date"]').all()
    const deadlineInput = inputs[0]
    const deliveryInput = inputs[1]

    await deadlineInput.fill("2027-01-15T10:00")
    await deliveryInput.fill("2027-01-10")

    const nextButton = page.getByRole("button", { name: "Next: Add Items" })
    await expect(nextButton).toBeDisabled()
    await expect(page.getByText("Order deadline must be before the delivery day")).toBeVisible()
  })

  test("should disable publish button when basket has no items", async ({ page }) => {
    const prisma = createPrisma()

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Empty Basket",
        orderDeadline: nextWeek,
        price: 20.0,
        deliveryDay: tomorrow,
        farmerId: farmer!.id,
        published: false,
      },
    })

    await prisma.$disconnect()

    await page.goto("/login")
    await page.fill('input[name="email"]', "farmer@cabazes.com")
    await page.fill('input[type="password"]', "Farmer123!")
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 })

    await page.goto(`/farmer/baskets/${basket.id}`)
    await expect(page.getByText("Test Empty Basket")).toBeVisible()

    const publishButton = page.getByRole("button", { name: "Publish" })
    await expect(publishButton).toBeDisabled()
  })

  test("should reject password shorter than 6 characters", async ({ request }) => {
    const res = await request.post("/api/auth/register", {
      data: {
        name: "Short Password User",
        email: "shortpass-" + Date.now() + "@example.com",
        phone: "+1234567890",
        address: "123 Test St",
        city: "Testville",
        postalCode: "00000",
        password: "abc",
      },
    })

    expect(res.ok()).toBeFalsy()
    expect(res.status()).toBe(400)
    const errorData = await res.json()
    expect(errorData.error).toBe("Password must be at least 8 characters")
  })

  test("should show deadline passed message on order page", async ({ page }) => {
    const prisma = createPrisma()

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Expired Order Basket",
        orderDeadline: yesterday,
        price: 25.0,
        deliveryDay: tomorrow,
        farmerId: farmer!.id,
        published: true,
      },
    })

    const tokenValue = "test-expired-order-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer!.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    await page.goto(`/order/${tokenValue}`)
    await expect(page.getByText("Order Deadline Passed")).toBeVisible()
  })

  test("should show token already used message on order page", async ({ page }) => {
    const prisma = createPrisma()

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Used Token Basket",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: tomorrow,
        farmerId: farmer!.id,
        published: true,
      },
    })

    const tokenValue = "test-used-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer!.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
        usedAt: new Date(),
      },
    })

    await prisma.$disconnect()

    await page.goto(`/order/${tokenValue}`)
    await expect(page.getByText("Order Already Placed")).toBeVisible()
  })
})
