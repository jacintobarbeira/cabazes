import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData, createTestFarmer, createTestCustomer, loginAsFarmerPage, TEST_PASSWORDS } from "./helpers"

const FARMER = "test-cc-farmer"
const HELPER = "test-cc-helper"
const CUSTOMER = "test-cc-customer"
const CUSTOMER_2 = "test-cc-customer2"
const FARMER_EMAIL = `${FARMER}@example.com`
const HELPER_EMAIL = `${HELPER}@example.com`
const CUSTOMER_EMAIL = `${CUSTOMER}@example.com`
const CUSTOMER_2_EMAIL = `${CUSTOMER_2}@example.com`
const VERIFY_PASSWORD = TEST_PASSWORDS.customer

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

async function createUnverifiedCustomer(
  prisma: any,
  farmerId: string,
  email: string,
  opts?: { disabled?: boolean; name?: string }
) {
  return prisma.user.create({
    data: {
      email,
      name: opts?.name || "Test Created Customer",
      role: "CUSTOMER",
      verified: false,
      disabled: opts?.disabled || false,
      customerFarmers: { create: { farmerId } },
    },
  })
}

async function createPublishedBasket(prisma: any, farmerId: string, name: string) {
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  return prisma.basket.create({
    data: {
      name,
      orderDeadline: nextWeek,
      price: 25.0,
      deliveryDay: inTwoWeeks,
      farmerId,
      published: true,
    },
  })
}

async function createInviteToken(prisma: any, customerId: string, basketId: string) {
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  return prisma.inviteToken.create({
    data: {
      customerId,
      basketId,
      token: "test-cc-token-" + Date.now(),
      expiresAt: nextWeek,
    },
  })
}

async function placeTokenOrder(request: any, basketId: string, token: string, extra?: any) {
  return request.post("/api/orders", {
    data: {
      basketId,
      token,
      deliveryAddress: "123 Test St",
      deliveryCity: "Testville",
      deliveryPostalCode: "00000",
      swapChoices: [],
      ...extra,
    },
  })
}

test.describe("Customer Creation", () => {
  test("farmer creates unverified customer linked to their farm", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    await prisma.$disconnect()

    await loginAsFarmerPage(page, FARMER_EMAIL, TEST_PASSWORDS.farmer)

    const res = await page.request.post("/api/customers", {
      data: {
        name: "Created Customer",
        email: CUSTOMER_EMAIL,
        phone: "+351000000000",
        address: "Rua Teste 1",
        city: "Lisboa",
        postalCode: "1000-001",
      },
    })
    expect(res.status()).toBe(201)
    const data = await res.json()
    expect(data.email).toBe(CUSTOMER_EMAIL)
    expect(data.verified).toBe(false)

    const prisma2 = createPrisma()
    const created = await prisma2.user.findUnique({
      where: { email: CUSTOMER_EMAIL },
      include: { customerFarmers: true },
    })
    expect(created).toBeTruthy()
    expect(created!.verified).toBe(false)
    expect(created!.passwordHash).toBeNull()
    expect(created!.customerFarmers).toHaveLength(1)
    expect(created!.customerFarmers[0].farmerId).toBe(farmer.id)
    await prisma2.$disconnect()
  })

  test("helper creates unverified customer linked to the farmer they manage", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const bcrypt = await import("bcryptjs")
    await prisma.user.create({
      data: {
        email: HELPER_EMAIL,
        name: "Test Helper",
        passwordHash: await bcrypt.hash("TempPass123!", 10),
        role: "FARMER_HELPER",
        managedById: farmer.id,
      },
    })
    await prisma.$disconnect()

    await loginAsFarmerPage(page, HELPER_EMAIL, "TempPass123!")

    const res = await page.request.post("/api/customers", {
      data: { name: "Helper Customer", email: CUSTOMER_EMAIL },
    })
    expect(res.status()).toBe(201)

    const prisma2 = createPrisma()
    const created = await prisma2.user.findUnique({
      where: { email: CUSTOMER_EMAIL },
      include: { customerFarmers: true },
    })
    expect(created!.customerFarmers).toHaveLength(1)
    expect(created!.customerFarmers[0].farmerId).toBe(farmer.id)
    await prisma2.$disconnect()
  })

  test("rejects duplicate and invalid emails", async ({ page }) => {
    const prisma = createPrisma()
    await createTestFarmer(prisma, FARMER)
    await prisma.$disconnect()

    await loginAsFarmerPage(page, FARMER_EMAIL, TEST_PASSWORDS.farmer)

    const first = await page.request.post("/api/customers", {
      data: { name: "Dup", email: CUSTOMER_EMAIL },
    })
    expect(first.status()).toBe(201)

    const dup = await page.request.post("/api/customers", {
      data: { name: "Dup 2", email: CUSTOMER_EMAIL },
    })
    expect(dup.status()).toBe(400)

    const invalid = await page.request.post("/api/customers", {
      data: { name: "Bad", email: "not-an-email" },
    })
    expect(invalid.status()).toBe(400)
  })

  test("customer role cannot create customers", async ({ page }) => {
    const prisma = createPrisma()
    await createTestFarmer(prisma, FARMER)
    await createTestCustomer(prisma, CUSTOMER)
    await prisma.$disconnect()

    await page.goto("/login")
    await page.waitForLoadState("networkidle")
    await page.fill('input[name="email"]', CUSTOMER_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORDS.customer)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*my-orders|.*baskets/, { timeout: 10000 })

    const res = await page.request.post("/api/customers", {
      data: { name: "Nope", email: CUSTOMER_2_EMAIL },
    })
    expect(res.status()).toBe(401)
  })

  test("disabled customers are excluded from the list", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    await createUnverifiedCustomer(prisma, farmer.id, CUSTOMER_EMAIL)
    await createUnverifiedCustomer(prisma, farmer.id, CUSTOMER_2_EMAIL, { disabled: true })
    await prisma.$disconnect()

    await loginAsFarmerPage(page, FARMER_EMAIL, TEST_PASSWORDS.farmer)

    const res = await page.request.get("/api/customers")
    const customers = await res.json()
    const emails = customers.map((c: any) => c.email)
    expect(emails).toContain(CUSTOMER_EMAIL)
    expect(emails).not.toContain(CUSTOMER_2_EMAIL)
  })

  test("order link shows account decision card for unverified customer", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createUnverifiedCustomer(prisma, farmer.id, CUSTOMER_EMAIL)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Customer Creation UI Basket")
    const token = await createInviteToken(prisma, customer.id, basket.id)
    await prisma.$disconnect()

    await page.goto(`/order/${token.token}`)
    await expect(page.getByText("Your account", { exact: true })).toBeVisible()
    await expect(page.getByText(/added to Test Farmer's customer list/)).toBeVisible()
    await expect(page.getByText(/Place order without an account/)).toBeVisible()
    await expect(page.getByText(/Create an account and place the order/)).toBeVisible()
    await expect(page.getByText(/Do not place an order and delete my record/)).toBeVisible()
  })

  test("verified customer does not see the account decision card", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createTestCustomer(prisma, CUSTOMER)
    await subscribe(prisma, customer.id, farmer.id)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Customer Creation Verified Basket")
    const token = await createInviteToken(prisma, customer.id, basket.id)
    await prisma.$disconnect()

    await page.goto(`/order/${token.token}`)
    await expect(page.getByText(/Place order without an account/)).not.toBeVisible()
  })

  test("unverified customer can place order without creating account", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createUnverifiedCustomer(prisma, farmer.id, CUSTOMER_EMAIL)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Customer Creation Unverified Order Basket")
    const token = await createInviteToken(prisma, customer.id, basket.id)
    await prisma.$disconnect()

    const res = await placeTokenOrder(page.request, basket.id, token.token)
    expect(res.status()).toBe(201)

    const prisma2 = createPrisma()
    const updated = await prisma2.user.findUnique({ where: { email: CUSTOMER_EMAIL } })
    expect(updated!.verified).toBe(false)
    expect(updated!.passwordHash).toBeNull()
    await prisma2.$disconnect()
  })

  test("unverified customer placing order with weak password is rejected", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createUnverifiedCustomer(prisma, farmer.id, CUSTOMER_EMAIL)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Customer Creation Weak Password Basket")
    const token = await createInviteToken(prisma, customer.id, basket.id)
    await prisma.$disconnect()

    const res = await placeTokenOrder(page.request, basket.id, token.token, { verifyPassword: "short" })
    expect(res.status()).toBe(400)

    const prisma2 = createPrisma()
    const updated = await prisma2.user.findUnique({ where: { email: CUSTOMER_EMAIL } })
    expect(updated!.verified).toBe(false)
    const orders = await prisma2.order.findMany({ where: { customerId: customer.id } })
    expect(orders).toHaveLength(0)
    await prisma2.$disconnect()
  })

  test("unverified customer can place order and verify account with password", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createUnverifiedCustomer(prisma, farmer.id, CUSTOMER_EMAIL)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Customer Creation Verify Basket")
    const token = await createInviteToken(prisma, customer.id, basket.id)
    await prisma.$disconnect()

    const res = await placeTokenOrder(page.request, basket.id, token.token, {
      verifyPassword: VERIFY_PASSWORD,
    })
    expect(res.status()).toBe(201)

    const prisma2 = createPrisma()
    const updated = await prisma2.user.findUnique({ where: { email: CUSTOMER_EMAIL } })
    expect(updated!.verified).toBe(true)
    expect(updated!.passwordHash).toBeTruthy()
    const orders = await prisma2.order.findMany({ where: { customerId: customer.id } })
    expect(orders).toHaveLength(1)
    await prisma2.$disconnect()
  })

  test("verified customer supplying verifyPassword is rejected", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createTestCustomer(prisma, CUSTOMER)
    await subscribe(prisma, customer.id, farmer.id)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Customer Creation Already Verified Basket")
    const token = await createInviteToken(prisma, customer.id, basket.id)
    await prisma.$disconnect()

    const res = await placeTokenOrder(page.request, basket.id, token.token, {
      verifyPassword: VERIFY_PASSWORD,
    })
    expect(res.status()).toBe(400)
  })

  test("delete request soft-disables the account and order page shows deactivated", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createUnverifiedCustomer(prisma, farmer.id, CUSTOMER_EMAIL)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Customer Creation Deletion Basket")
    const token = await createInviteToken(prisma, customer.id, basket.id)
    await prisma.$disconnect()

    const res = await page.request.post("/api/account/delete-request", {
      data: { token: token.token },
    })
    expect(res.ok()).toBeTruthy()

    const prisma2 = createPrisma()
    const updated = await prisma2.user.findUnique({ where: { email: CUSTOMER_EMAIL } })
    expect(updated!.disabled).toBe(true)
    await prisma2.$disconnect()

    await page.goto(`/order/${token.token}`)
    await expect(page.getByText("Account Deactivated", { exact: true })).toBeVisible()
  })

  test("delete request is idempotent and customer cannot place order afterwards", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    const customer = await createUnverifiedCustomer(prisma, farmer.id, CUSTOMER_EMAIL)
    const basket = await createPublishedBasket(prisma, farmer.id, "Test Customer Creation Disabled Order Basket")
    const token = await createInviteToken(prisma, customer.id, basket.id)
    await prisma.$disconnect()

    const first = await page.request.post("/api/account/delete-request", {
      data: { token: token.token },
    })
    expect(first.ok()).toBeTruthy()
    const second = await page.request.post("/api/account/delete-request", {
      data: { token: token.token },
    })
    expect(second.ok()).toBeTruthy()

    const res = await placeTokenOrder(page.request, basket.id, token.token)
    expect(res.status()).toBe(400)
  })
})

async function subscribe(prisma: any, customerId: string, farmerId: string) {
  await prisma.customerFarmer.create({ data: { customerId, farmerId } })
}
