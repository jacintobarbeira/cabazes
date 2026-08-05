-- Swap model reset
-- Baskets now have exactly two sets of items (base and swap) plus a
-- fixed number of allowed swaps. SwapGroup is removed entirely.
-- All basket item and order data is discarded.

-- Clear order / item data
DELETE FROM "OrderSwapChoice";
DELETE FROM "Order";
DELETE FROM "BasketItem";

-- Remove SwapGroup and old swap choice tables
DROP TABLE "SwapGroup";
DROP TABLE "OrderSwapChoice";

-- Add Basket.allowedSwaps (default 3)
ALTER TABLE "Basket" ADD COLUMN "allowedSwaps" INTEGER NOT NULL DEFAULT 3;

-- Rebuild BasketItem without the swapGroupId column
CREATE TABLE "new_BasketItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "basketId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "isBase" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "BasketItem_basketId_fkey" FOREIGN KEY ("basketId") REFERENCES "Basket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BasketItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BasketItem" ("id", "basketId", "productId", "quantity", "isBase")
SELECT "id", "basketId", "productId", "quantity", "isBase" FROM "BasketItem";
DROP TABLE "BasketItem";
ALTER TABLE "new_BasketItem" RENAME TO "BasketItem";
CREATE INDEX "BasketItem_basketId_idx" ON "BasketItem"("basketId");
CREATE INDEX "BasketItem_productId_idx" ON "BasketItem"("productId");

-- Recreate OrderSwapChoice with base/swap item pairing
CREATE TABLE "OrderSwapChoice" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "baseItemId" TEXT NOT NULL,
  "swapItemId" TEXT NOT NULL,
  CONSTRAINT "OrderSwapChoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderSwapChoice_baseItemId_fkey" FOREIGN KEY ("baseItemId") REFERENCES "BasketItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OrderSwapChoice_swapItemId_fkey" FOREIGN KEY ("swapItemId") REFERENCES "BasketItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "OrderSwapChoice_orderId_idx" ON "OrderSwapChoice"("orderId");
