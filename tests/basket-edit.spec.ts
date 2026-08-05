import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData, createTestFarmer, createTestCustomer, TEST_PASSWORDS } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

async function loginAsFarmer(request: any, farmer: { email: string }) {
  const res = await request.post("/api/auth/login", {
    data: { email: farmer.email, password: TEST_PASSWORDS.farmer },
  })
  expect(res.ok()).toBeTruthy()
}

async function loginAsFarmerPage(page: any, farmer: { email: string }) {
  await page.goto("/login")
  await page.waitForLoadState("networkidle")
  await page.fill('input[name="email"]', farmer.email)
  await page.fill('input[type="password"]', TEST_PASSWORDS.farmer)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 })
}

async function createDraftBasket(prisma: any, farmerId: string) {
  const carrot = await prisma.product.create({
    data: {
      name: "Test Edit Carrot",
      farmerId,
      active: true,
    },
  })

  const potato = await prisma.product.create({
    data: {
      name: "Test Edit Potato",
      farmerId,
      active: true,
    },
  })

  const apple = await prisma.product.create({
    data: {
      name: "Test Edit Apple",
      farmerId,
      active: true,
    },
  })

  const banana = await prisma.product.create({
    data: {
      name: "Test Edit Banana",
      farmerId,
      active: true,
    },
  })

  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const basket = await prisma.basket.create({
    data: {
      name: "Test Edit Basket",
      description: "Editable basket",
      orderDeadline: tomorrow,
      price: 25.5,
      deliveryDay: nextWeek,
      allowedSwaps: 3,
      farmerId,
      published: false,
    },
  })

  await prisma.basketItem.create({
    data: {
      basketId: basket.id,
      productId: carrot.id,
      isBase: true,
    },
  })

  await prisma.basketItem.create({
    data: {
      basketId: basket.id,
      productId: potato.id,
      isBase: true,
    },
  })

  await prisma.basketItem.create({
    data: {
      basketId: basket.id,
      productId: apple.id,
      isBase: false,
    },
  })

  return { basket, carrot, potato, apple, banana }
}

test.describe("Basket Edit", () => {
  test("farmer edits basket details and allowedSwaps while draft", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const { basket } = await createDraftBasket(prisma, farmer.id)
    await prisma.$disconnect()

    await loginAsFarmer(request, farmer)

    const newDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const newDelivery = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)

    const res = await request.patch(`/api/baskets/${basket.id}`, {
      data: {
        name: "Test Edit Basket Updated",
        description: "Updated description",
        orderDeadline: newDeadline.toISOString(),
        price: "29.9",
        deliveryDay: newDelivery.toISOString(),
        allowedSwaps: "5",
      },
    })
    expect(res.ok()).toBeTruthy()
    const updated = await res.json()

    expect(updated.name).toBe("Test Edit Basket Updated")
    expect(updated.description).toBe("Updated description")
    expect(updated.price).toBe("29.9")
    expect(updated.allowedSwaps).toBe(5)
    expect(new Date(updated.orderDeadline).toISOString()).toBe(newDeadline.toISOString())
    expect(new Date(updated.deliveryDay).toISOString()).toBe(newDelivery.toISOString())
    expect(updated.published).toBe(false)
  })

  test("farmer replaces base and swap items while draft", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const { basket, banana, carrot } = await createDraftBasket(prisma, farmer.id)
    await prisma.$disconnect()

    await loginAsFarmer(request, farmer)

    const res = await request.put(`/api/baskets/${basket.id}/contents`, {
      data: {
        items: [
          { productId: carrot.id, isBase: true },
          { productId: banana.id, isBase: false },
        ],
      },
    })
    expect(res.ok()).toBeTruthy()
    const updated = await res.json()

    const baseItems = updated.items.filter((i: any) => i.isBase)
    expect(baseItems.length).toBe(1)
    expect(baseItems[0].productName).toBe("Test Edit Carrot")

    const swapItems = updated.items.filter((i: any) => !i.isBase)
    expect(swapItems.length).toBe(1)
    expect(swapItems[0].productName).toBe("Test Edit Banana")
  })

  test("contents replace updates allowedSwaps", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const { basket } = await createDraftBasket(prisma, farmer.id)
    await prisma.$disconnect()

    await loginAsFarmer(request, farmer)

    const res = await request.put(`/api/baskets/${basket.id}/contents`, {
      data: { items: [], allowedSwaps: "1" },
    })
    expect(res.ok()).toBeTruthy()
    const updated = await res.json()
    expect(updated.items.length).toBe(0)
    expect(updated.allowedSwaps).toBe(1)
  })

  test("farmer can remove all items", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const { basket } = await createDraftBasket(prisma, farmer.id)
    await prisma.$disconnect()

    await loginAsFarmer(request, farmer)

    const res = await request.put(`/api/baskets/${basket.id}/contents`, {
      data: { items: [] },
    })
    expect(res.ok()).toBeTruthy()
    const updated = await res.json()
    expect(updated.items.length).toBe(0)
  })

  test("helper can edit a draft basket", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)

    const helperPassword = "TempPass123!"
    const bcrypt = await import("bcryptjs")
    const passwordHash = await bcrypt.hash(helperPassword, 10)

    await prisma.user.create({
      data: {
        email: "test-helper-edit@example.com",
        name: "Test Helper",
        passwordHash,
        role: "FARMER_HELPER",
        phone: "+1234567890",
        managedById: farmer.id,
        mustResetPassword: false,
      },
    })

    const { basket } = await createDraftBasket(prisma, farmer.id)
    await prisma.$disconnect()

    const loginRes = await request.post("/api/auth/login", {
      data: { email: "test-helper-edit@example.com", password: helperPassword },
    })
    expect(loginRes.ok()).toBeTruthy()

    const newDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const newDelivery = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)

    const patchRes = await request.patch(`/api/baskets/${basket.id}`, {
      data: {
        name: "Test Edit Helper Basket",
        orderDeadline: newDeadline.toISOString(),
        deliveryDay: newDelivery.toISOString(),
      },
    })
    expect(patchRes.ok()).toBeTruthy()
    expect((await patchRes.json()).name).toBe("Test Edit Helper Basket")

    const contentsRes = await request.put(`/api/baskets/${basket.id}/contents`, {
      data: { items: [] },
    })
    expect(contentsRes.ok()).toBeTruthy()
  })

  test("published basket cannot be edited", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const { basket } = await createDraftBasket(prisma, farmer.id)
    await prisma.basket.update({
      where: { id: basket.id },
      data: { published: true },
    })
    await prisma.$disconnect()

    await loginAsFarmer(request, farmer)

    const patchRes = await request.patch(`/api/baskets/${basket.id}`, {
      data: { name: "Test Edit Basket Updated" },
    })
    expect(patchRes.status()).toBe(400)
    expect((await patchRes.json()).error).toBe("Published baskets cannot be edited")

    const contentsRes = await request.put(`/api/baskets/${basket.id}/contents`, {
      data: { items: [] },
    })
    expect(contentsRes.status()).toBe(400)
    expect((await contentsRes.json()).error).toBe("Published baskets cannot be edited")
  })

  test("contents replace rejects products from another farmer", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const { basket, carrot } = await createDraftBasket(prisma, farmer.id)

    const bcrypt = await import("bcryptjs")
    const otherFarmerHash = await bcrypt.hash("TempPass123!", 10)

    const otherFarmer = await prisma.user.create({
      data: {
        email: "test-edit-other-farmer@example.com",
        name: "Other Farmer",
        passwordHash: otherFarmerHash,
        role: "FARMER",
      },
    })

    const foreignProduct = await prisma.product.create({
      data: {
        name: "Test Edit Foreign Product",
        farmerId: otherFarmer.id,
        active: true,
      },
    })

    await prisma.$disconnect()

    await loginAsFarmer(request, farmer)

    const res = await request.put(`/api/baskets/${basket.id}/contents`, {
      data: {
        items: [
          { productId: carrot.id, isBase: true },
          { productId: foreignProduct.id, isBase: false },
        ],
      },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe("One or more products not found")
  })

  test("contents replace rejects overlapping base and swap products", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const { basket, carrot } = await createDraftBasket(prisma, farmer.id)
    await prisma.$disconnect()

    await loginAsFarmer(request, farmer)

    const overlap = await request.put(`/api/baskets/${basket.id}/contents`, {
      data: {
        items: [
          { productId: carrot.id, isBase: true },
          { productId: carrot.id, isBase: false },
        ],
      },
    })
    expect(overlap.status()).toBe(400)
    expect((await overlap.json()).error).toBe("A product cannot be both a base item and a swap item")
  })

  test("non-farmer cannot edit a basket", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)
    const { basket } = await createDraftBasket(prisma, farmer.id)
    await prisma.$disconnect()

    const customerRes = await request.post("/api/auth/login", {
      data: { email: customer.email, password: TEST_PASSWORDS.customer },
    })
    expect(customerRes.ok()).toBeTruthy()

    const patchRes = await request.patch(`/api/baskets/${basket.id}`, {
      data: { name: "Test Edit Basket Updated" },
    })
    expect(patchRes.status()).toBe(401)

    const contentsRes = await request.put(`/api/baskets/${basket.id}/contents`, {
      data: { items: [] },
    })
    expect(contentsRes.status()).toBe(401)
  })

  test("edit of non-existent basket returns 404", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    await prisma.$disconnect()

    await loginAsFarmer(request, farmer)

    const patchRes = await request.patch("/api/baskets/non-existent-id", {
      data: { name: "Test Edit Basket Updated" },
    })
    expect(patchRes.status()).toBe(404)

    const contentsRes = await request.put("/api/baskets/non-existent-id/contents", {
      data: { items: [] },
    })
    expect(contentsRes.status()).toBe(404)
  })

  test("draft basket shows edit page with prefilled data and saves changes", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const { basket } = await createDraftBasket(prisma, farmer.id)
    await prisma.$disconnect()

    await loginAsFarmerPage(page, farmer)

    await page.goto(`/farmer/baskets/${basket.id}/edit`)
    await expect(page.getByRole("heading", { name: "Edit Basket" })).toBeVisible()

    await expect(page.locator('input[placeholder="e.g. Summer Basket"]')).toHaveValue("Test Edit Basket")

    await page.locator('input[placeholder="e.g. Summer Basket"]').fill("Test Edit Basket Updated")
    await page.getByRole("button", { name: "Next: Add Items" }).click()
    await expect(page.getByText("Test Edit Carrot")).toBeVisible()
    await page.getByRole("button", { name: "Next: Swap Items" }).click()
    await expect(page.getByText("Test Edit Apple")).toBeVisible()
    await page.getByRole("button", { name: "Save Changes" }).click()

    await expect(page).toHaveURL(new RegExp(`/farmer/baskets/${basket.id}$`))
    await expect(page.getByRole("heading", { name: "Test Edit Basket Updated" })).toBeVisible()

    const verifyRes = await page.request.get(`/api/baskets/${basket.id}`)
    expect(verifyRes.ok()).toBeTruthy()
    const updated = await verifyRes.json()
    expect(updated.name).toBe("Test Edit Basket Updated")
    expect(updated.price).toBe("25.5")
  })

  test("published basket has no edit button and edit page is blocked", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const { basket } = await createDraftBasket(prisma, farmer.id)
    await prisma.basket.update({
      where: { id: basket.id },
      data: { published: true },
    })
    await prisma.$disconnect()

    await loginAsFarmerPage(page, farmer)

    await page.goto(`/farmer/baskets/${basket.id}`)
    await expect(page.getByRole("heading", { name: "Test Edit Basket" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0)

    await page.goto(`/farmer/baskets/${basket.id}/edit`)
    await expect(page.getByText("This basket is published and can no longer be edited.")).toBeVisible()
  })
})
