-- Remove unit column from Product
ALTER TABLE "Product" DROP COLUMN "unit";

-- Remove quantity column from BasketItem
ALTER TABLE "BasketItem" DROP COLUMN "quantity";
