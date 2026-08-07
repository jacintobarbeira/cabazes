import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData, createTestFarmer, createTestCustomer, createTestProduct, createTestBasket, loginAsFarmerRequest, loginAsCustomerRequest } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

async function createSourceBasket(prisma: any, farmerId: string) {
  const carrot = await createTestProduct(prisma, farmerId, "Test Clone Carrot")
  const potato = await createTestProduct(prisma, farmerId, "Test Clone Potato")
  const apple = await createTestProduct(prisma, farmerId, "Test Clone Apple")

  return createTestBasket(prisma, farmerId, {
    name: "Test Clone Basket",
    description: "Original basket description",
    items: [
      { productId: carrot.id, isBase: true },
      { productId: potato.id, isBase: false },
      { productId: apple.id, isBase: false },
    ],
    allowedSwaps: 3,
    price: 25.5,
    published: true,
  })
}

test.describe("Basket Clone", () => {
  test("farmer clones basket with base and swap items", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const basket = await createSourceBasket(prisma, farmer.id)
    await prisma.$disconnect()

    await loginAsFarmerRequest(request, farmer)

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
    const farmer = await createTestFarmer(prisma)
    const basket = await createSourceBasket(prisma, farmer.id)
    await prisma.$disconnect()

    await loginAsFarmerRequest(request, farmer)

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
    const farmer = await createTestFarmer(prisma)
    const basket = await createSourceBasket(prisma, farmer.id)
    await prisma.$disconnect()

    await loginAsFarmerRequest(request, farmer)

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
    const farmer = await createTestFarmer(prisma)
    const basket = await createSourceBasket(prisma, farmer.id)
    await prisma.$disconnect()

    await loginAsFarmerRequest(request, farmer)

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
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)
    const basket = await createSourceBasket(prisma, farmer.id)
    await prisma.$disconnect()

    await loginAsCustomerRequest(request, customer)

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
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    await prisma.$disconnect()

    await loginAsFarmerRequest(request, farmer)

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
