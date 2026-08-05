import { PrismaClient } from "@prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import bcrypt from "bcryptjs"

async function main() {
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || "file:./prisma/dev.db",
  })

  const prisma = new PrismaClient({ adapter })

  const farmerPassword = await bcrypt.hash("Farmer123!", 10)

  const adminPassword = await bcrypt.hash("Admin123!", 10)

  await prisma.user.upsert({
    where: { email: "admin@cabazes.com" },
    update: {
      passwordHash: adminPassword,
      disabled: false,
      mustResetPassword: false,
    },
    create: {
      email: "admin@cabazes.com",
      name: "Admin User",
      passwordHash: adminPassword,
      role: "ADMINISTRATOR",
      phone: "+0000000000",
    },
  })

  const farmer = await prisma.user.upsert({
    where: { email: "farmer@cabazes.com" },
    update: {
      passwordHash: farmerPassword,
      disabled: false,
      mustResetPassword: false,
    },
    create: {
      email: "farmer@cabazes.com",
      name: "Farmer John",
      passwordHash: farmerPassword,
      role: "FARMER",
      phone: "+1234567890",
    },
  })

  const customerPassword = await bcrypt.hash("Customer123!", 10)

  await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {
      passwordHash: customerPassword,
      disabled: false,
      mustResetPassword: false,
    },
    create: {
      email: "alice@example.com",
      name: "Alice Smith",
      passwordHash: customerPassword,
      role: "CUSTOMER",
      phone: "+1111111111",
      address: "123 Main St",
      city: "Springfield",
      postalCode: "12345",
      notes: "Leave at the front door",
    },
  })

  await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {
      passwordHash: customerPassword,
      disabled: false,
      mustResetPassword: false,
    },
    create: {
      email: "bob@example.com",
      name: "Bob Johnson",
      passwordHash: customerPassword,
      role: "CUSTOMER",
      phone: "+2222222222",
      address: "456 Oak Ave",
      city: "Springfield",
      postalCode: "12345",
    },
  })

  const products = [
    { name: "Carrots", category: "vegetable" },
    { name: "Onions", category: "vegetable" },
    { name: "Lettuce", category: "vegetable" },
    { name: "Tomatoes", category: "vegetable" },
    { name: "Potatoes", category: "vegetable" },
    { name: "Oranges", category: "fruit" },
    { name: "Basil", category: "herb" },
    { name: "Garlic", category: "vegetable" },
    { name: "Peppers", category: "vegetable" },
    { name: "Zucchini", category: "vegetable" },
  ]

  for (const product of products) {
    await prisma.product.upsert({
      where: {
        name_farmerId: { name: product.name, farmerId: farmer.id },
      },
      update: { category: product.category },
      create: {
        ...product,
        farmerId: farmer.id,
      },
    })
  }

  console.log("Seed data created successfully!")
  console.log("Admin: admin@cabazes.com / admin123")
  console.log("Farmer: farmer@cabazes.com / farmer123")
  console.log("Customer: alice@example.com / customer123")
  console.log("Customer: bob@example.com / customer123")

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
