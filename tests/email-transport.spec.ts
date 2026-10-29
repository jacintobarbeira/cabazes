import { test, expect } from "@playwright/test"
import type { APIRequestContext } from "@playwright/test"
import {
  createPrisma,
  cleanupTestData,
  createTestFarmer,
  createTestCustomer,
  clearCapturedEmails,
  readCapturedEmails,
  TEST_PASSWORDS,
} from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
  clearCapturedEmails()
})

test.afterEach(async () => {
  await cleanupTestData()
  clearCapturedEmails()
})

async function createPublishedBasket(prisma: ReturnType<typeof createPrisma>, farmerId: string, name: string) {
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

  return prisma.basket.create({
    data: {
      name,
      orderDeadline: nextWeek,
      price: 20,
      deliveryDay: tomorrow,
      published: true,
      farmerId,
    },
  })
}

async function login(request: APIRequestContext, email: string, password: string) {
  const res = await request.post("/api/auth/login", { data: { email, password } })
  expect(res.ok()).toBeTruthy()
}

test.describe("Email sink transport", () => {
  test("captures order link email instead of sending it", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    await prisma.user.update({
      where: { id: farmer.id },
      data: { senderEmail: "myfarm@example.com" },
    })

    const basket = await createPublishedBasket(prisma, farmer.id, "Test Email Sink Basket")
    const token = await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: `test-email-sink-token-${Date.now()}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    await prisma.$disconnect()

    await login(request, farmer.email, TEST_PASSWORDS.farmer)

    const sendRes = await request.post(`/api/baskets/${basket.id}/links/send-email`, {
      data: { tokenIds: [token.id] },
    })
    expect(sendRes.ok()).toBeTruthy()

    const emails = readCapturedEmails()
    expect(emails).toHaveLength(1)
    expect(emails[0].to).toBe(customer.email)
    expect(emails[0].from).toBe("myfarm@example.com")
    expect(emails[0].subject).toBe("Your order link for Test Email Sink Basket")
    expect(emails[0].html).toContain(`/order/${token.token}`)
    expect(emails[0].html).toContain("Test Email Sink Basket")
  })

  test("captures delivered notification", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Email Sink Delivered")

    const order = await prisma.order.create({
      data: {
        basketId: basket.id,
        customerId: customer.id,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        customerName: customer.name,
        customerEmail: customer.email,
        status: "CONFIRMED",
      },
    })
    await prisma.$disconnect()

    await login(request, farmer.email, TEST_PASSWORDS.farmer)

    const res = await request.patch(`/api/orders/${order.id}`, { data: { status: "DELIVERED" } })
    expect(res.ok()).toBeTruthy()

    await expect
      .poll(() => readCapturedEmails().length, { timeout: 5000 })
      .toBeGreaterThan(0)

    const emails = readCapturedEmails()
    expect(emails).toHaveLength(1)
    expect(emails[0].to).toBe(customer.email)
    expect(emails[0].subject).toBe("Your Test Email Sink Delivered order has been delivered")
  })

  test("does not capture anything when the request is rejected", async ({ request }) => {
    const prisma = createPrisma()
    const customer = await createTestCustomer(prisma)
    const basket = await createPublishedBasket(prisma, (await createTestFarmer(prisma)).id, "Test Email Sink Rejected")

    const token = await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: `test-email-sink-rejected-${Date.now()}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    await prisma.$disconnect()

    await login(request, customer.email, TEST_PASSWORDS.customer)

    const res = await request.post(`/api/baskets/${basket.id}/links/send-email`, {
      data: { tokenIds: [token.id] },
    })
    expect(res.status()).toBe(401)
    expect(readCapturedEmails()).toHaveLength(0)
  })

  test("does not capture anything when the token is not found", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Email Sink Missing Token")
    await prisma.$disconnect()

    await login(request, farmer.email, TEST_PASSWORDS.farmer)

    const res = await request.post(`/api/baskets/${basket.id}/links/send-email`, {
      data: { tokenIds: ["does-not-exist"] },
    })
    expect(res.status()).toBe(404)
    expect(readCapturedEmails()).toHaveLength(0)
  })
})