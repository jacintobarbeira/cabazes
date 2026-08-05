import { PrismaClient } from "@prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import bcrypt from "bcryptjs"

const TEST_USER_PREFIX = "test-"
const TEST_BASKET_PREFIX = "Test "
const TEST_PRODUCT_PREFIX = "Test "
const TEST_TOKEN_PREFIX = "test-"

async function main() {
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || "file:./prisma/dev.db",
  })
  const prisma = new PrismaClient({ adapter })

  console.log("Cleaning any test data from production database...")

  await prisma.orderSwapChoice.deleteMany({
    where: { order: { basket: { name: { startsWith: TEST_BASKET_PREFIX } } } },
  })
  await prisma.order.deleteMany({
    where: { basket: { name: { startsWith: TEST_BASKET_PREFIX } } },
  })
  await prisma.inviteToken.deleteMany({
    where: { token: { startsWith: TEST_TOKEN_PREFIX } },
  })
  await prisma.basketItem.deleteMany({
    where: { basket: { name: { startsWith: TEST_BASKET_PREFIX } } },
  })
  await prisma.basket.deleteMany({
    where: { name: { startsWith: TEST_BASKET_PREFIX } },
  })
  await prisma.product.deleteMany({
    where: { name: { startsWith: TEST_PRODUCT_PREFIX } },
  })
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_USER_PREFIX } },
  })
  await prisma.authThrottle.deleteMany({
    where: { key: { startsWith: TEST_USER_PREFIX } },
  })

  console.log("Test data cleaned.")

  const adminExists = await prisma.user.findUnique({
    where: { email: "admin@cabazes.com" },
  })

  if (!adminExists) {
    const passwordHash = await bcrypt.hash("Admin123!", 10)

    await prisma.user.create({
      data: {
        email: "admin@cabazes.com",
        name: "Admin",
        passwordHash,
        role: "ADMINISTRATOR",
        phone: "+0000000000",
      },
    })

    console.log("Admin account created.")
  } else {
    console.log("Admin already exists — skipping seed.")
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
