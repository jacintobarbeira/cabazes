-- CreateTable
CREATE TABLE "DeliveryPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "postalCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryPoint_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BasketDeliveryPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "basketId" TEXT NOT NULL,
    "deliveryPointId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BasketDeliveryPoint_basketId_fkey" FOREIGN KEY ("basketId") REFERENCES "Basket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BasketDeliveryPoint_deliveryPointId_fkey" FOREIGN KEY ("deliveryPointId") REFERENCES "DeliveryPoint" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "basketId" TEXT NOT NULL,
    "inviteTokenId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deliveryAddress" TEXT NOT NULL,
    "deliveryCity" TEXT,
    "deliveryPostalCode" TEXT,
    "deliveryNotes" TEXT,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deliveryPointId" TEXT,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_basketId_fkey" FOREIGN KEY ("basketId") REFERENCES "Basket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_inviteTokenId_fkey" FOREIGN KEY ("inviteTokenId") REFERENCES "InviteToken" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_deliveryPointId_fkey" FOREIGN KEY ("deliveryPointId") REFERENCES "DeliveryPoint" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("basketId", "createdAt", "customerEmail", "customerId", "customerName", "customerPhone", "deliveryAddress", "deliveryCity", "deliveryNotes", "deliveryPostalCode", "id", "inviteTokenId", "status", "updatedAt") SELECT "basketId", "createdAt", "customerEmail", "customerId", "customerName", "customerPhone", "deliveryAddress", "deliveryCity", "deliveryNotes", "deliveryPostalCode", "id", "inviteTokenId", "status", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_inviteTokenId_key" ON "Order"("inviteTokenId");
CREATE INDEX "Order_basketId_idx" ON "Order"("basketId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE UNIQUE INDEX "Order_customerId_basketId_key" ON "Order"("customerId", "basketId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DeliveryPoint_farmerId_idx" ON "DeliveryPoint"("farmerId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPoint_name_farmerId_key" ON "DeliveryPoint"("name", "farmerId");

-- CreateIndex
CREATE INDEX "BasketDeliveryPoint_basketId_idx" ON "BasketDeliveryPoint"("basketId");

-- CreateIndex
CREATE INDEX "BasketDeliveryPoint_deliveryPointId_idx" ON "BasketDeliveryPoint"("deliveryPointId");

-- CreateIndex
CREATE UNIQUE INDEX "BasketDeliveryPoint_basketId_deliveryPointId_key" ON "BasketDeliveryPoint"("basketId", "deliveryPointId");
