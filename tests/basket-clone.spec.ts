import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

async function loginAsFarmer(request: any) {
  const res = await request.post("/api/auth/login", {
    data: { email: "farmer@cabazes.com", password: "Farmer123!" },
  })
  expect(res.ok()).toBeTruthy()
}

async function createSourceBasket(prisma: any) {
  const farmer = await prisma.user.findUnique({
    where: { email: "farmer@cabazes.com" },
  })

  const product1 = await prisma.product.create({
    data: {
      name: "Test Clone Carrot",
      farmerId: farmer!.id,
      active: true,
    },
  })

  const product2 = await prisma.product.create({
    data: {
      name: "Test Clone Potato",
      farmerId: farmer!.id,
      active: true,
    },
  })

  const product3 = await prisma.product.create({
    data: {
      name: "Test Clone Apple",
      farmerId: farmer!.id,
      active: true,
    },
  })

  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const basket = await prisma.basket.create({
    data: {
      name: "Test Clone Basket",
      description: "Original basket description",
      orderDeadline: nextWeek,
      price: 25.5,
      deliveryDay: tomorrow,
      allowedSwaps: 3,
      farmerId: farmer!.id,
      published: true,
    },
  })

  await prisma.basketItem.create({
    data: {
      basketId: basket.id,
      productId: product1.id,
      isBase: true,
    },
  })

  await prisma.basketItem.create({
    data: {
      basketId: basket.id,
      productId: product2.id,
      isBase: false,
    },
  })

  await prisma.basketItem.create({
    data: {
      basketId: basket.id,
      productId: product3.id,
      isBase: false,
    },
  })

  return basket
}

test.describe("Basket Clone", () => {
  test("farmer clones basket with base and swap items", async ({ request }) => {
    const prisma = createPrisma()
    const basket = await createSourceBasket(prisma)
    await prisma.$disconnect()

    await loginAsFarmer(request)

    const newDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const newDelivery = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)

    const cloneRes = await request.post(`/api/baskets/${basket.id}/clone`, {
      data: {
        name: "Test Clone Basket 2",
        orderDeadline: newDeadline.toISOString(),
        deliveryDay: newDelivery.toISOString(),
      },
    })
    expect(cloneRes.ok()).toBeTruthy()
    expect(cloneRes.status()).toBe(201)
    const cloned = await cloneRes.json()

    expect(cloned.id).not.toBe(basket.id)
    expect(cloned.name).toBe("Test Clone Basket 2")
    expect(cloned.description).toBe("Original basket description")
    expect(cloned.price).toBe("25.5")
    expect(cloned.published).toBe(false)
    expect(cloned.allowedSwaps).toBe(3)

    const baseItems = cloned.items.filter((i: any) => i.isBase)
    expect(baseItems.length).toBe(1)
    expect(baseItems[0].productName).toBe("Test Clone Carrot")

    const swapItems = cloned.items.filter((i: any) => !i.isBase)
    expect(swapItems.length).toBe(2)
    const names = swapItems.map((i: any) => i.productName).sort()
    expect(names).toEqual(["Test Clone Apple", "Test Clone Potato"])
  })

  test("clone requires new deadline and delivery dates", async ({ request }) => {
    const prisma = createPrisma()
    const basket = await createSourceBasket(prisma)
    await prisma.$disconnect()

    await loginAsFarmer(request)

    const newDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const newDelivery = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)

    const missingDeadline = await request.post(`/api/baskets/${basket.id}/clone`, {
      data: {
        name: "Test Clone Basket 2",
        deliveryDay: newDelivery.toISOString(),
      },
    })
    expect(missingDeadline.ok()).toBeFalsy()
    expect(missingDeadline.status()).toBe(400)

    const missingDelivery = await request.post(`/api/baskets/${basket.id}/clone`, {
      data: {
        name: "Test Clone Basket 2",
        orderDeadline: newDeadline.toISOString(),
      },
    })
    expect(missingDelivery.ok()).toBeFalsy()
    expect(missingDelivery.status()).toBe(400)
  })

  test("clone rejects deadline after delivery day", async ({ request }) => {
    const prisma = createPrisma()
    const basket = await createSourceBasket(prisma)
    await prisma.$disconnect()

    await loginAsFarmer(request)

    const newDeadline = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
    const newDelivery = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const cloneRes = await request.post(`/api/baskets/${basket.id}/clone`, {
      data: {
        name: "Test Clone Basket 2",
        orderDeadline: newDeadline.toISOString(),
        deliveryDay: newDelivery.toISOString(),
      },
    })
    expect(cloneRes.ok()).toBeFalsy()
    expect(cloneRes.status()).toBe(400)
  })

  test("clone rejects duplicate name and delivery day", async ({ request }) => {
    const prisma = createPrisma()
    const basket = await createSourceBasket(prisma)
    await prisma.$disconnect()

    await loginAsFarmer(request)

    const newDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const newDelivery = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)

    const first = await request.post(`/api/baskets/${basket.id}/clone`, {
      data: {
        name: "Test Clone Basket 2",
        orderDeadline: newDeadline.toISOString(),
        deliveryDay: newDelivery.toISOString(),
      },
    })
    expect(first.ok()).toBeTruthy()

    const duplicate = await request.post(`/api/baskets/${basket.id}/clone`, {
      data: {
        name: "Test Clone Basket 2",
        orderDeadline: newDeadline.toISOString(),
        deliveryDay: newDelivery.toISOString(),
      },
    })
    expect(duplicate.ok()).toBeFalsy()
    expect(duplicate.status()).toBe(400)
  })

  test("non-farmer cannot clone a basket", async ({ request }) => {
    const prisma = createPrisma()
    const basket = await createSourceBasket(prisma)
    await prisma.$disconnect()

    const customerRes = await request.post("/api/auth/login", {
      data: { email: "alice@example.com", password: "Customer123!" },
    })
    expect(customerRes.ok()).toBeTruthy()

    const cloneRes = await request.post(`/api/baskets/${basket.id}/clone`, {
      data: {
        name: "Test Clone Basket 2",
        orderDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        deliveryDay: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
    })
    expect(cloneRes.ok()).toBeFalsy()
    expect(cloneRes.status()).toBe(401)
  })

  test("clone of non-existent basket returns 404", async ({ request }) => {
    await loginAsFarmer(request)

    const cloneRes = await request.post("/api/baskets/non-existent-id/clone", {
      data: {
        name: "Test Clone Basket 2",
        orderDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        deliveryDay: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
    })
    expect(cloneRes.ok()).toBeFalsy()
    expect(cloneRes.status()).toBe(404)
  })
})
