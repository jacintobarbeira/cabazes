import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData } from "./helpers"

const TEST_FARMER_EMAIL = "test-revoked-farmer@example.com"
const TEST_DELETED_EMAIL = "test-revoked-deleted@example.com"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

async function createFarmer(email: string) {
  const prisma = createPrisma()
  const passwordHash = await require("bcryptjs").hash("TempPass123!", 10)
  const farmer = await prisma.user.create({
    data: {
      email,
      name: "Revocation Test Farmer",
      passwordHash,
      role: "FARMER",
      phone: "+1234567890",
      mustResetPassword: false,
    },
  })
  await prisma.$disconnect()
  return farmer
}

test.describe("Session revocation", () => {
  test("disabling a farmer immediately revokes an existing session", async ({ browser }) => {
    const farmer = await createFarmer(TEST_FARMER_EMAIL)

    const farmerCtx = await browser.newContext({ baseURL: "http://localhost:3000" })
    const adminCtx = await browser.newContext({ baseURL: "http://localhost:3000" })

    const farmerLogin = await farmerCtx.request.post("/api/auth/login", {
      data: { email: TEST_FARMER_EMAIL, password: "TempPass123!" },
    })
    expect(farmerLogin.ok()).toBeTruthy()

    const meBefore = await farmerCtx.request.get("/api/farmer/me")
    expect(meBefore.status()).toBe(200)

    const adminLogin = await adminCtx.request.post("/api/auth/login", {
      data: { email: "admin@cabazes.com", password: "Admin123!" },
    })
    expect(adminLogin.ok()).toBeTruthy()

    const disableRes = await adminCtx.request.patch(`/api/admin/farmers/${farmer.id}/toggle-disabled`)
    expect(disableRes.ok()).toBeTruthy()

    const meAfter = await farmerCtx.request.get("/api/farmer/me")
    expect(meAfter.status()).toBe(401)

    const ordersAfter = await farmerCtx.request.get("/api/orders")
    expect(ordersAfter.status()).toBe(401)

    const page = await farmerCtx.newPage()
    await page.goto("/farmer/dashboard")
    await expect(page).toHaveURL(/\/login/)

    await farmerCtx.close()
    await adminCtx.close()
  })

  test("deleting a farmer immediately revokes an existing session", async ({ browser }) => {
    const farmer = await createFarmer(TEST_DELETED_EMAIL)

    const farmerCtx = await browser.newContext({ baseURL: "http://localhost:3000" })
    const adminCtx = await browser.newContext({ baseURL: "http://localhost:3000" })

    const farmerLogin = await farmerCtx.request.post("/api/auth/login", {
      data: { email: TEST_DELETED_EMAIL, password: "TempPass123!" },
    })
    expect(farmerLogin.ok()).toBeTruthy()

    const meBefore = await farmerCtx.request.get("/api/farmer/me")
    expect(meBefore.status()).toBe(200)

    const adminLogin = await adminCtx.request.post("/api/auth/login", {
      data: { email: "admin@cabazes.com", password: "Admin123!" },
    })
    expect(adminLogin.ok()).toBeTruthy()

    const deleteRes = await adminCtx.request.delete(`/api/admin/farmers/${farmer.id}`)
    expect(deleteRes.ok()).toBeTruthy()

    const meAfter = await farmerCtx.request.get("/api/farmer/me")
    expect(meAfter.status()).toBe(401)

    const page = await farmerCtx.newPage()
    await page.goto("/farmer/dashboard")
    await expect(page).toHaveURL(/\/login/)

    await farmerCtx.close()
    await adminCtx.close()
  })

  test("enabled farmer keeps an active session", async ({ browser }) => {
    const farmer = await createFarmer(TEST_FARMER_EMAIL)

    const farmerCtx = await browser.newContext({ baseURL: "http://localhost:3000" })

    const farmerLogin = await farmerCtx.request.post("/api/auth/login", {
      data: { email: TEST_FARMER_EMAIL, password: "TempPass123!" },
    })
    expect(farmerLogin.ok()).toBeTruthy()

    const me = await farmerCtx.request.get("/api/farmer/me")
    expect(me.status()).toBe(200)

    const page = await farmerCtx.newPage()
    await page.goto("/farmer/dashboard")
    await expect(page).toHaveURL(/\/farmer\/dashboard/)

    await farmerCtx.close()
  })
})
