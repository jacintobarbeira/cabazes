import { PrismaClient } from "@prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import bcrypt from "bcryptjs"

async function main() {
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || "file:./prisma/dev.db",
  })
  const prisma = new PrismaClient({ adapter })

  const adminExists = await prisma.user.findUnique({
    where: { email: "admin@cabazes.com" },
  })

  if (adminExists) {
    console.log("Admin already exists — skipping seed.")
    await prisma.$disconnect()
    return
  }

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
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
