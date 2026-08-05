-- CreateTable
CREATE TABLE "CustomerFarmer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerFarmer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerFarmer_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CustomerFarmer_customerId_idx" ON "CustomerFarmer"("customerId");

-- CreateIndex
CREATE INDEX "CustomerFarmer_farmerId_idx" ON "CustomerFarmer"("farmerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerFarmer_customerId_farmerId_key" ON "CustomerFarmer"("customerId", "farmerId");
