import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData, createTestFarmer, createTestCustomer, TEST_PASSWORDS } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

test.describe("Sender Email", () => {
  test("farmer can set and retrieve senderEmail via settings API", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    await prisma.$disconnect()

    const farmerRes = await request.post("/api/auth/login", {
      data: { email: farmer.email, password: TEST_PASSWORDS.farmer },
    })
    expect(farmerRes.ok()).toBeTruthy()

    const patchRes = await request.patch("/api/farmer/me", {
      data: { senderEmail: "myfarm@example.com" },
    })
    expect(patchRes.ok()).toBeTruthy()
    const updated = await patchRes.json()
    expect(updated.senderEmail).toBe("myfarm@example.com")

    const getRes = await request.get("/api/farmer/me")
    expect(getRes.ok()).toBeTruthy()
    const user = await getRes.json()
    expect(user.senderEmail).toBe("myfarm@example.com")
  })

  test("farmer can clear senderEmail", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    await prisma.user.update({
      where: { id: farmer.id },
      data: { senderEmail: "myfarm@example.com" },
    })
    await prisma.$disconnect()

    const farmerRes = await request.post("/api/auth/login", {
      data: { email: farmer.email, password: TEST_PASSWORDS.farmer },
    })
    expect(farmerRes.ok()).toBeTruthy()

    const patchRes = await request.patch("/api/farmer/me", {
      data: { senderEmail: null },
    })
    expect(patchRes.ok()).toBeTruthy()
    const updated = await patchRes.json()
    expect(updated.senderEmail).toBeNull()
  })

  test("non-farmer cannot set senderEmail", async ({ request }) => {
    const prisma = createPrisma()
    const customer = await createTestCustomer(prisma)
    await prisma.$disconnect()

    const customerRes = await request.post("/api/auth/login", {
      data: { email: customer.email, password: TEST_PASSWORDS.customer },
    })
    expect(customerRes.ok()).toBeTruthy()

    const patchRes = await request.patch("/api/farmer/me", {
      data: { senderEmail: "hacker@example.com" },
    })
    expect(patchRes.ok()).toBeFalsy()
    expect(patchRes.status()).toBe(401)
  })

  test("send-email route uses farmer senderEmail when set", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    await prisma.user.update({
      where: { id: farmer.id },
      data: { senderEmail: "myfarm@example.com" },
    })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        farmerId: farmer.id,
        name: "Test Sender Email Basket",
        orderDeadline: nextWeek,
        price: 20,
        deliveryDay: tomorrow,
        published: true,
      },
    })

    const token = await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: "test-sender-email-token",
        expiresAt: nextWeek,
      },
    })
    await prisma.$disconnect()

    const farmerRes = await request.post("/api/auth/login", {
      data: { email: farmer.email, password: TEST_PASSWORDS.farmer },
    })
    expect(farmerRes.ok()).toBeTruthy()

    const sendRes = await request.post(`/api/baskets/${basket.id}/links/send-email`, {
      data: { tokenIds: [token.id] },
    })
    expect(sendRes.ok()).toBeTruthy()
    const result = await sendRes.json()
    expect(result.results[0].sent).toBe(true)
  })

  test("farmer settings page renders senderEmail field", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    await prisma.user.update({
      where: { id: farmer.id },
      data: { senderEmail: "myfarm@example.com" },
    })
    await prisma.$disconnect()

    await page.goto("/login")
    await page.fill('input[name="email"]', farmer.email)
    await page.fill('input[type="password"]', TEST_PASSWORDS.farmer)
    await page.click('button[type="submit"]')
    await page.waitForURL(/.*dashboard/, { timeout: 10000 })

    await page.goto("/farmer/settings")
    await page.waitForLoadState("networkidle")

    const input = page.locator('input[type="email"]')
    await expect(input).toHaveValue("myfarm@example.com")
  })
})
