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
]

export function createPrisma() {
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || "file:./prisma/dev.db",
  })
  return new PrismaClient({ adapter })
}

export async function cleanupTestData() {
  const prisma = createPrisma()

  for (const email of TEST_USER_EMAILS) {
    await prisma.user.delete({ where: { email } }).catch(() => {})
  }

  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_USER_PREFIX } },
  })

  const basketNameFilter = {
    OR: TEST_BASKET_PREFIXES.map((prefix) => ({ name: { startsWith: prefix } })),
  }

  await prisma.orderSwapChoice.deleteMany({
    where: {
      order: {
        basket: basketNameFilter,
      },
    },
  })

  await prisma.order.deleteMany({
    where: {
      basket: basketNameFilter,
    },
  })

  await prisma.inviteToken.deleteMany({
    where: { token: { startsWith: TEST_TOKEN_PREFIX } },
  })

  await prisma.product.deleteMany({
    where: {
      name: { startsWith: "Test " },
    },
  })

  await prisma.basket.deleteMany({
    where: basketNameFilter,
  })

  await prisma.$disconnect()
}
