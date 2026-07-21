import { test, expect } from "@playwright/test"

test.describe("Login", () => {
  test("should redirect to farmer dashboard after successful login", async ({ page }) => {
    await page.goto("/login")

    await page.fill('input[name="email"]', "farmer@cabazes.com")
    await page.fill('input[type="password"]', "Farmer123!")
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

    await page.fill('input[name="email"]', "alice@example.com")
    await page.fill('input[type="password"]', "Customer123!")
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
