-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryAssignedAt" TIMESTAMP(3),
ADD COLUMN     "deliveryPartnerId" TEXT,
ADD COLUMN     "pickedUpAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_deliveryPartnerId_status_idx" ON "Order"("deliveryPartnerId", "status");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryPartnerId_fkey" FOREIGN KEY ("deliveryPartnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
