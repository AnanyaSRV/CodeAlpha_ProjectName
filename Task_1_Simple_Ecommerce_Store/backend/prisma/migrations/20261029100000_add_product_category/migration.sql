ALTER TABLE "Product"
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Uncategorized';

UPDATE "Product"
SET "category" = substring("description" FROM 'Category: ([^.]+)\.')
WHERE "description" ~ 'Category: [^.]+\.';

CREATE INDEX "Product_category_idx" ON "Product"("category");