import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData } from "./helpers"

const TEST_FARMER = "test-login-farmer@example.com"
const TEST_CUSTOMER = "test-login-customer@example.com"
const PASSWORD = "Login123!"

async function createTestUsers() {
  const prisma = createPrisma()
  const bcrypt = await import("bcryptjs")
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  await prisma.user.create({
    data: { email: TEST_FARMER, name: "Test Farmer", passwordHash, role: "FARMER", phone: "+1111111111" },
  })
  await prisma.user.create({
    data: { email: TEST_CUSTOMER, name: "Test Customer", passwordHash, role: "CUSTOMER", phone: "+2222222222", address: "123 Main St", city: "Springfield", postalCode: "12345" },
  })
  await prisma.$disconnect()
}

test.beforeEach(async () => {
  await cleanupTestData()
  await createTestUsers()
})

test.afterEach(async () => {
  await cleanupTestData()
})

test.describe("Login", () => {
  test("should redirect to farmer dashboard after successful login", async ({ page }) => {
    await page.goto("/login")

    await page.fill('input[name="email"]', TEST_FARMER)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 })
    await expect(page.locator("h1")).toContainText("Dashboard")
  })

  test("should show error with invalid credentials", async ({ page }) => {
    await page.goto("/login")

    await page.fill('input[name="email"]', "wrong@example.com")
    await page.fill('input[type="password"]', "wrongpassword")
    await page.click('button[type="submit"]')

    await expect(page.getByText("Invalid email or password")).toBeVisible()
    await expect(page).toHaveURL(/.*login/)
  })

  test("should redirect customer to my-orders after login", async ({ page }) => {
    await page.goto("/login")

    await page.fill('input[name="email"]', TEST_CUSTOMER)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/.*my-orders/, { timeout: 10000 })
    await expect(page.getByText("🧺 Cabazes")).toBeVisible()
    await expect(page.getByText("Sign out")).toBeVisible()
  })
})

test.describe("Registration", () => {
  test("should show phone and address fields", async ({ page }) => {
    await page.goto("/register")

    await expect(page.getByLabel("Phone *")).toBeVisible()
    await expect(page.getByLabel("Delivery Address *")).toBeVisible()
    await expect(page.getByLabel("City")).toBeVisible()
    await expect(page.getByLabel("Postal Code")).toBeVisible()
  })
})
