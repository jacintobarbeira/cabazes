import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData } from "./helpers"

const TEMP_PASSWORD = "TempPass123!"
const NEW_PASSWORD = "BrandNew456!"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

test.describe("First login password reset flow", () => {
  test("farmer with mustResetPassword flag resets password and reaches dashboard", async ({ page }) => {
    const prisma = createPrisma()

    const passwordHash = await require("bcryptjs").hash(TEMP_PASSWORD, 10)

    await prisma.user.create({
      data: {
        email: "test-reset-flow@example.com",
        name: "Reset Flow Farmer",
        passwordHash,
        role: "FARMER",
        mustResetPassword: true,
      },
    })

    await prisma.$disconnect()

    const loginRes = await page.request.post("/api/auth/login", {
      data: { email: "test-reset-flow@example.com", password: TEMP_PASSWORD },
    })
    expect(loginRes.ok()).toBeTruthy()

    await page.goto("/reset-password")
    await expect(page).toHaveURL(/.*reset-password/, { timeout: 10000 })

    await page.fill('input[type="password"] >> nth=0', NEW_PASSWORD)
    await page.fill('input[type="password"] >> nth=1', NEW_PASSWORD)
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/.*farmer\/dashboard/, { timeout: 10000 })

    const sessionRes = await page.request.get("/api/auth/session")
    const session = await sessionRes.json()
    expect(session.user.mustResetPassword).toBe(false)
  })

  test("customer with mustResetPassword flag resets password and reaches my-orders", async ({ page }) => {
    const prisma = createPrisma()

    const passwordHash = await require("bcryptjs").hash(TEMP_PASSWORD, 10)

    await prisma.user.create({
      data: {
        email: "test-reset-customer@example.com",
        name: "Reset Flow Customer",
        passwordHash,
        role: "CUSTOMER",
        mustResetPassword: true,
      },
    })

    await prisma.$disconnect()

    const loginRes = await page.request.post("/api/auth/login", {
      data: { email: "test-reset-customer@example.com", password: TEMP_PASSWORD },
    })
    expect(loginRes.ok()).toBeTruthy()

    await page.goto("/reset-password")
    await expect(page).toHaveURL(/.*reset-password/, { timeout: 10000 })

    await page.fill('input[type="password"] >> nth=0', NEW_PASSWORD)
    await page.fill('input[type="password"] >> nth=1', NEW_PASSWORD)
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/.*my-orders/, { timeout: 10000 })

    const sessionRes = await page.request.get("/api/auth/session")
    const session = await sessionRes.json()
    expect(session.user.mustResetPassword).toBe(false)
  })
})
