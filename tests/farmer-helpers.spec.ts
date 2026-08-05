import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData, createTestFarmer, TEST_PASSWORDS } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

async function loginAs(page: any, email: string, password: string) {
  await page.goto("/login")
  await page.fill('input[name="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/.*(dashboard|my-orders|reset-password)/, { timeout: 10000 })
}

test.describe("Farmer Helpers", () => {
  test("farmer creates helper and helper can access farmer data", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Helper Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer.id,
        published: true,
      },
    })

    await prisma.$disconnect()

    await loginAs(page, farmer.email, TEST_PASSWORDS.farmer)

    const createRes = await page.request.post("/api/farmer/helpers", {
      data: {
        name: "Test Helper",
        email: "test-helper@example.com",
        phone: "+1234567890",
      },
    })
    expect(createRes.ok()).toBeTruthy()
    expect(createRes.status()).toBe(201)
    const helperData = await createRes.json()
    expect(helperData.tempPassword).toBeTruthy()
    expect(helperData.tempPassword.length).toBe(12)

    const listRes = await page.request.get("/api/farmer/helpers")
    expect(listRes.ok()).toBeTruthy()
    const helpers = await listRes.json()
    expect(helpers.some((h: any) => h.email === "test-helper@example.com")).toBeTruthy()

    const basketsRes = await page.request.get("/api/baskets")
    expect(basketsRes.ok()).toBeTruthy()
    const baskets = await basketsRes.json()
    expect(baskets.some((b: any) => b.name === "Test Helper Basket")).toBeTruthy()
  })

  test("helper can access farmer baskets and orders", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)

    const helperPassword = "TempPass123!"
    const bcrypt = await import("bcryptjs")
    const passwordHash = await bcrypt.hash(helperPassword, 10)

    await prisma.user.create({
      data: {
        email: "test-helper-access@example.com",
        name: "Test Helper",
        passwordHash,
        role: "FARMER_HELPER",
        phone: "+1234567890",
        managedById: farmer.id,
        mustResetPassword: false,
      },
    })

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.basket.create({
      data: {
        name: "Test Helper Access Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer.id,
        published: true,
      },
    })

    await prisma.$disconnect()

    await page.goto("/login")
    await page.fill('input[name="email"]', "test-helper-access@example.com")
    await page.fill('input[type="password"]', helperPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 })

    const basketsRes = await page.request.get("/api/baskets")
    expect(basketsRes.ok()).toBeTruthy()
    const baskets = await basketsRes.json()
    expect(baskets.some((b: any) => b.name === "Test Helper Access Basket")).toBeTruthy()

    const productsRes = await page.request.get("/api/products")
    expect(productsRes.ok()).toBeTruthy()
  })

  test("helper cannot create other helpers", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)

    const helperPassword = "TempPass123!"
    const bcrypt = await import("bcryptjs")
    const passwordHash = await bcrypt.hash(helperPassword, 10)

    await prisma.user.create({
      data: {
        email: "test-helper-no-create@example.com",
        name: "Test Helper",
        passwordHash,
        role: "FARMER_HELPER",
        phone: "+1234567890",
        managedById: farmer.id,
        mustResetPassword: false,
      },
    })

    await prisma.$disconnect()

    await page.goto("/login")
    await page.fill('input[name="email"]', "test-helper-no-create@example.com")
    await page.fill('input[type="password"]', helperPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 })

    const createRes = await page.request.post("/api/farmer/helpers", {
      data: {
        name: "Sub Helper",
        email: "sub-helper@example.com",
      },
    })
    expect(createRes.ok()).toBeFalsy()
    expect(createRes.status()).toBe(401)
  })

  test("farmer disables helper and helper cannot login", async ({ browser, page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)

    const helperPassword = "TempPass123!"
    const bcrypt = await import("bcryptjs")
    const passwordHash = await bcrypt.hash(helperPassword, 10)

    const helper = await prisma.user.create({
      data: {
        email: "test-helper-disable@example.com",
        name: "Test Helper",
        passwordHash,
        role: "FARMER_HELPER",
        phone: "+1234567890",
        managedById: farmer.id,
        mustResetPassword: false,
      },
    })

    await prisma.$disconnect()

    await loginAs(page, farmer.email, TEST_PASSWORDS.farmer)

    const disableRes = await page.request.patch(`/api/farmer/helpers/${helper.id}`)
    expect(disableRes.ok()).toBeTruthy()
    const result = await disableRes.json()
    expect(result.disabled).toBe(true)

    const newContext = await browser.newContext()
    const newPage = await newContext.newPage()
    await newPage.goto("/login")
    await newPage.waitForSelector('input[name="email"]')
    await newPage.fill('input[name="email"]', "test-helper-disable@example.com")
    await newPage.fill('input[type="password"]', helperPassword)
    await newPage.locator('form button[type="submit"]').click()
    await expect(newPage).toHaveURL(/.*login.*error=CredentialsSignin/, { timeout: 10000 })
    await newContext.close()
  })

  test("farmer enables disabled helper and helper can login again", async ({ browser, page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)

    const helperPassword = "TempPass123!"
    const bcrypt = await import("bcryptjs")
    const passwordHash = await bcrypt.hash(helperPassword, 10)

    const helper = await prisma.user.create({
      data: {
        email: "test-helper-enable@example.com",
        name: "Test Helper",
        passwordHash,
        role: "FARMER_HELPER",
        phone: "+1234567890",
        managedById: farmer.id,
        mustResetPassword: false,
        disabled: true,
      },
    })

    await prisma.$disconnect()

    await loginAs(page, farmer.email, TEST_PASSWORDS.farmer)

    const enableRes = await page.request.patch(`/api/farmer/helpers/${helper.id}`)
    expect(enableRes.ok()).toBeTruthy()
    const result = await enableRes.json()
    expect(result.disabled).toBe(false)

    const newContext = await browser.newContext()
    const newPage = await newContext.newPage()
    await newPage.goto("/login")
    await newPage.waitForSelector('input[name="email"]')
    await newPage.fill('input[name="email"]', "test-helper-enable@example.com")
    await newPage.fill('input[type="password"]', helperPassword)
    await newPage.locator('form button[type="submit"]').click()
    await expect(newPage).toHaveURL(/.*dashboard/, { timeout: 10000 })
    await newContext.close()
  })
})
