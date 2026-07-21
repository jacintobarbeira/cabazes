import { PrismaClient } from "@prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import { spawn } from "child_process"
import { resolve } from "path"

async function main() {
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || "file:./prisma/dev.db",
  })
  const prisma = new PrismaClient({ adapter })

  console.log("Cleaning test data from database...")

  await prisma.orderSwapChoice.deleteMany({})
  await prisma.order.deleteMany({})
  await prisma.inviteToken.deleteMany({})
  await prisma.basket.deleteMany({})
  await prisma.product.deleteMany({})

  await prisma.user.deleteMany({
    where: {
      email: {
        notIn: ["farmer@cabazes.com", "alice@example.com", "bob@example.com"],
      },
    },
  })

  await prisma.session.deleteMany({})
  await prisma.account.deleteMany({})

  console.log("Test data cleaned. Re-seeding database...")

  await prisma.$disconnect()

  const seedProcess = spawn("npx", ["tsx", "prisma/seed.ts"], {
    stdio: "inherit",
    cwd: resolve(__dirname, ".."),
  })

  await new Promise<void>((resolve, reject) => {
    seedProcess.on("close", (code) => {
      if (code === 0) {
        console.log("Database cleaned and re-seeded successfully!")
        resolve()
      } else {
        reject(new Error(`Seed process exited with code ${code}`))
      }
    })
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
