import { PrismaClient } from "@prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"

const TEST_BASKET_PREFIXES = [
  "Test ",
  "Duplicate ",
  "Same Name ",
  "Single Order ",
  "Restrict Delete ",
  "Expired ",
  "Active ",
  "Empty ",
  "Test Confirm ",
  "Test Already Confirmed ",
  "Test Deliver ",
  "Test Deliver Pending ",
  "Test Already Delivered ",
  "Test Cancel ",
  "Test Cancel Pending ",
  "Test Cancel Delivered ",
  "Test Already Cancelled ",
  "Test Farmer Cancel ",
  "Test Cross Farmer Confirm ",
  "Test Cross Customer Cancel ",
  "Test Deliveries Date ",
  "Test Delete ",
  "Test Edit ",
  "Test Edit Blocked ",
  "Test Deliveries Link ",
  "Test Deliveries Multi ",
  "Test Deliveries View ",
  "Test Deliveries Link2 ",
  "Test Deliveries Expand ",
  "Test Deliveries SwapView ",
  "Test Deliveries Collapse ",
  "Test Orders Page ",
  "Test Orders Link ",
  "Test Orders Expand ",
  "Test Orders SwapView ",
  "Test Orders Collapse ",
  "Test Dedup ",
  "Scope Basket",
  "Other Scope Basket",
  "Test Delivery Points ",
  "Test Available ",
]

const TEST_TOKEN_PREFIX = "test-"
const TEST_USER_PREFIX = "newuser-"
const TEST_USER_EMAILS = [
  "test-customer@example.com",
  "test-customer-2@example.com",
  "test-farmer-2@example.com",
  "test-helper@example.com",
  "test-helper-access@example.com",
  "test-helper-no-create@example.com",
  "test-helper-disable@example.com",
  "test-helper-enable@example.com",
  "test-admin-farmer@example.com",
  "test-admin-disable-helper@example.com",
  "test-admin-enable-helper@example.com",
  "unauthorized@example.com",
  "newuser-test@example.com",
  "test-delete-farmer@example.com",
  "test-delete-helper@example.com",
  "test-send-link@example.com",
  "test-sender-email@example.com",
  "test-helper-edit@example.com",
  "test-edit-other-farmer@example.com",
  "test-revoked-farmer@example.com",
  "test-revoked-deleted@example.com",
  "test-customer-scope@example.com",
  "test-customer-scope-other@example.com",
  "test-farmer-scope@example.com",
  "test-helper-scope@example.com",
  "scope-other-farmer@example.com",
  "test-reset-flow@example.com",
  "test-reset-customer@example.com",
  "test-rate-limit@example.com",
  "test-rate-limit-b@example.com",
  "test-rate-limit-c@example.com",
  "test-rate-limit-d@example.com",
  "test-login-farmer@example.com",
  "test-login-customer@example.com",
  "test-idor-farmer-a@example.com",
  "test-idor-farmer-b@example.com",
  "test-newfeat-customer@example.com",
  "test-newfeat-farmera@example.com",
  "test-newfeat-farmerb@example.com",
  "test-constraints-farmer@example.com",
  "test-seed-farmer@example.com",
  "test-seed-customer@example.com",
  "test-seed-admin@example.com",
  "test-available-customer@example.com",
  "test-available-farmer@example.com",
  "test-available-farmer-b@example.com",
]

export const TEST_PASSWORDS = {
  farmer: "TestFarmer123!",
  customer: "TestCustomer123!",
  admin: "TestAdmin123!",
}

export async function createTestFarmer(prisma: any, opts?: { email?: string } | string) {
  const email = typeof opts === "string" ? `${opts}@example.com` : (opts?.email || "test-seed-farmer@example.com")
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash(TEST_PASSWORDS.farmer, 10)
  return prisma.user.create({
    data: { email, name: "Test Farmer", passwordHash: hash, role: "FARMER", phone: "+1111111111" },
  })
}

export async function createTestCustomer(prisma: any, opts?: { email?: string } | string) {
  const email = typeof opts === "string" ? `${opts}@example.com` : (opts?.email || "test-seed-customer@example.com")
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash(TEST_PASSWORDS.customer, 10)
  return prisma.user.create({
    data: { email, name: "Test Customer", passwordHash: hash, role: "CUSTOMER", phone: "+2222222222", address: "123 Test St", city: "Testville", postalCode: "00000" },
  })
}

export async function createTestAdmin(prisma: any, opts?: { email?: string } | string) {
  const email = typeof opts === "string" ? `${opts}@example.com` : (opts?.email || "test-seed-admin@example.com")
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash(TEST_PASSWORDS.admin, 10)
  return prisma.user.create({
    data: { email, name: "Test Admin", passwordHash: hash, role: "ADMINISTRATOR", phone: "+3333333333" },
  })
}

export async function createTestDeliveryPoint(
  prisma: any,
  farmerId: string,
  opts?: { name?: string; address?: string; city?: string; postalCode?: string } | string
) {
  const baseName = typeof opts === "string" ? opts : (opts?.name || "Test Delivery Point")
  return prisma.deliveryPoint.create({
    data: {
      name: baseName,
      address: opts && typeof opts === "object" ? (opts.address || `${baseName} 1`) : `${baseName} 1`,
      city: opts && typeof opts === "object" ? (opts.city || null) : null,
      postalCode: opts && typeof opts === "object" ? (opts.postalCode || null) : null,
      farmerId,
    },
  })
}

export async function subscribeCustomer(
  prisma: any,
  customerId: string,
  farmerId: string
) {
  return prisma.customerFarmer.create({
    data: { customerId, farmerId },
  })
}

export function createPrisma() {
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || "file:./prisma/test.db",
  })
  return new PrismaClient({ adapter })
}

function isTransientError(err: unknown): boolean {
  return (
    err instanceof Error &&
    err.name === "PrismaClientKnownRequestError" &&
    /Operation has timed out/i.test(err.message)
  )
}

async function cleanupTestDataOnce() {
  // Small delay to let app server release DB connections
  await new Promise((resolve) => setTimeout(resolve, 200))

  const prisma = createPrisma()

  try {
    const baskets = await prisma.basket.findMany({
      where: {
        OR: TEST_BASKET_PREFIXES.map((prefix) => ({ name: { startsWith: prefix } })),
      },
      select: { id: true },
    })

    const basketIds = baskets.map((b) => b.id)

    if (basketIds.length > 0) {
      await prisma.order.deleteMany({
        where: { basketId: { in: basketIds } },
      })

      await prisma.basket.deleteMany({
        where: { id: { in: basketIds } },
      })
    }

    await prisma.product.deleteMany({
      where: {
        name: { startsWith: "Test " },
      },
    })

    await prisma.deliveryPoint.deleteMany({
      where: {
        name: { startsWith: "Test " },
      },
    })

    const testUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { in: TEST_USER_EMAILS } },
          { email: { startsWith: TEST_USER_PREFIX } },
        ],
      },
      select: { id: true },
    })

    const testUserIds = testUsers.map((u: { id: string }) => u.id)

    if (testUserIds.length > 0) {
      await prisma.customerFarmer.deleteMany({
        where: { OR: [{ customerId: { in: testUserIds } }, { farmerId: { in: testUserIds } }] },
      })
    }

    for (const email of TEST_USER_EMAILS) {
      await prisma.user.delete({ where: { email } }).catch(() => {})
    }

    await prisma.user.deleteMany({
      where: { email: { startsWith: TEST_USER_PREFIX } },
    })

    await prisma.authThrottle.deleteMany({
      where: {
        key: {
          in: [
            ...TEST_USER_EMAILS,
            ...TEST_USER_EMAILS.map((e) => `login:${e}`),
            ...TEST_USER_EMAILS.map((e) => `register:${e}`),
          ],
        },
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}

export async function cleanupTestData() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await cleanupTestDataOnce()
      return
    } catch (err) {
      if (attempt === 3 || !isTransientError(err)) {
        throw err
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    }
  }
}
