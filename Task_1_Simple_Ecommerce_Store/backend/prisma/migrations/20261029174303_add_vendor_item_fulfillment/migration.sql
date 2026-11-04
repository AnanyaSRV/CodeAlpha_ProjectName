-- CreateEnum
CREATE TYPE "VendorFulfillmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');

-- DropIndex
DROP INDEX "Product_category_idx";

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "fulfillmentStatus" "VendorFulfillmentStatus" NOT NULL DEFAULT 'PENDING';
