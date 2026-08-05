-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BasketItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "basketId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "isBase" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "BasketItem_basketId_fkey" FOREIGN KEY ("basketId") REFERENCES "Basket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BasketItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BasketItem" ("basketId", "id", "isBase", "productId") SELECT "basketId", "id", "isBase", "productId" FROM "BasketItem";
DROP TABLE "BasketItem";
ALTER TABLE "new_BasketItem" RENAME TO "BasketItem";
CREATE INDEX "BasketItem_basketId_idx" ON "BasketItem"("basketId");
CREATE INDEX "BasketItem_productId_idx" ON "BasketItem"("productId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Basket_farmerId_idx" ON "Basket"("farmerId");

-- CreateIndex
CREATE INDEX "Order_basketId_idx" ON "Order"("basketId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Product_farmerId_idx" ON "Product"("farmerId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteToken_basketId_customerId_key" ON "InviteToken"("basketId", "customerId");
