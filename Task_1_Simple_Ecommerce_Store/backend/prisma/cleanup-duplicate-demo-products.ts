
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";

const DEMO_PREFIX = "[MH-DEMO-";
const EXPECTED_TOTAL = 1000;
const EXPECTED_UNIQUE_NAMES = 100;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing. Check your backend .env file.");
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function normalizedName(name: string): string {
  return name.replace(/^\[MH-DEMO-\d+\]\s*/i, "").trim().toLowerCase();
}

async function main() {
  console.log("\n=== MarketHub duplicate demo-product cleanup ===");
  console.log("Safety mode: backup first, validate, then delete duplicates.");

  const products = await prisma.product.findMany({
    where: { name: { startsWith: DEMO_PREFIX } },
    include: { orderItems: { select: { id: true } } },
    orderBy: { name: "asc" },
  });

  console.log(`Demo products found: ${products.length}`);

  if (products.length !== EXPECTED_TOTAL) {
    throw new Error(
      `STOP: Expected ${EXPECTED_TOTAL} demo products, found ${products.length}. Nothing deleted.`,
    );
  }

  const groups = new Map<string, typeof products>();

  for (const product of products) {
    const key = normalizedName(product.name);

    if (!key) {
      throw new Error(`STOP: Empty normalized product name: ${product.id}`);
    }

    const group = groups.get(key) ?? [];
    group.push(product);
    groups.set(key, group);
  }

  if (groups.size !== EXPECTED_UNIQUE_NAMES) {
    throw new Error(
      `STOP: Expected ${EXPECTED_UNIQUE_NAMES} unique names, found ${groups.size}. Nothing deleted.`,
    );
  }

  for (const [name, group] of groups) {
    if (group.length < 2) {
      throw new Error(
        `STOP: "${name}" has only ${group.length} record. Nothing deleted.`,
      );
    }
  }

  const referenced = products.filter((p) => p.orderItems.length > 0);

  if (referenced.length > 0) {
    console.error("STOP: Some demo products are referenced by order items:");
    console.error(
      referenced.map((p) => ({
        id: p.id,
        name: p.name,
        orderItemCount: p.orderItems.length,
      })),
    );
    throw new Error("No products deleted because order references exist.");
  }

  // Keep the record with the lowest demo number in each duplicate group.
  const toKeep: typeof products = [];
  const toDelete: typeof products = [];

  for (const group of groups.values()) {
    group.sort((a, b) => {
      const aMatch = a.name.match(/^\[MH-DEMO-(\d+)\]/i);
      const bMatch = b.name.match(/^\[MH-DEMO-(\d+)\]/i);
      const aNumber = aMatch ? Number(aMatch[1]) : Number.MAX_SAFE_INTEGER;
      const bNumber = bMatch ? Number(bMatch[1]) : Number.MAX_SAFE_INTEGER;
      return aNumber - bNumber || a.id.localeCompare(b.id);
    });

    toKeep.push(group[0]);
    toDelete.push(...group.slice(1));
  }

  if (toKeep.length !== EXPECTED_UNIQUE_NAMES ||
      toDelete.length !== EXPECTED_TOTAL - EXPECTED_UNIQUE_NAMES) {
    throw new Error("STOP: Internal count check failed. Nothing deleted.");
  }

  const fashionProducts = toKeep.filter(
    (p) => p.category.toLowerCase() === "fashion",
  );

  const expectedFashionImages = new Set([
    "/images/fashion/01_cotton_t_shirt.png",
    "/images/fashion/02_casual_shirt.png",
    "/images/fashion/03_everyday_hoodie.png",
    "/images/fashion/04_classic_denim_jeans.png",
    "/images/fashion/05_relaxed_fit_trousers.png",
    "/images/fashion/06_knit_sweater.png",
    "/images/fashion/07_casual_kurta.png",
  ]);

  for (const imageUrl of expectedFashionImages) {
    const matching = fashionProducts.filter((p) => p.imageUrl === imageUrl);

    if (matching.length !== 1) {
      throw new Error(
        `STOP: Expected exactly one retained Fashion product with image ${imageUrl}; found ${matching.length}. Nothing deleted.`,
      );
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.resolve(
    "prisma",
    `demo-product-duplicate-backup-${timestamp}.json`,
  );

  const backup = {
    createdAt: new Date().toISOString(),
    description:
      "Full pre-deletion backup of duplicate demo products, including fields and order-item references.",
    deletedProducts: toDelete.map(({ orderItems, ...product }) => ({
      ...product,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      orderItems,
    })),
    retainedProducts: toKeep.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      imageUrl: p.imageUrl,
      vendorId: p.vendorId,
    })),
    counts: {
      before: products.length,
      retained: toKeep.length,
      plannedForDeletion: toDelete.length,
    },
  };

  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf8");

  console.log("\nBackup saved BEFORE deletion:");
  console.log(backupPath);
  console.log(`Records to retain: ${toKeep.length}`);
  console.log(`Duplicate records to delete: ${toDelete.length}`);
  console.log(`Retained Fashion products checked: ${fashionProducts.length}`);

  console.log("\nPreview of records marked for deletion:");
  for (const p of toDelete.slice(0, 15)) {
    console.log(`- ${p.name} | ${p.category} | ${p.id}`);
  }
  if (toDelete.length > 15) {
    console.log(`... and ${toDelete.length - 15} more`);
  }

  const confirmation = process.argv.includes("--confirm-delete");

  if (!confirmation) {
    console.log("\nPREVIEW ONLY. No database records were deleted.");
    console.log(
      "Review the backup and preview. To execute later, rerun with --confirm-delete.",
    );
    return;
  }

  const idsToDelete = toDelete.map((p) => p.id);

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.product.findMany({
      where: { id: { in: idsToDelete } },
      include: { orderItems: { select: { id: true } } },
    });

    if (fresh.length !== idsToDelete.length) {
      throw new Error("STOP: Product records changed after preview.");
    }

    const newlyReferenced = fresh.filter((p) => p.orderItems.length > 0);

    if (newlyReferenced.length > 0) {
      throw new Error(
        "STOP: Order references appeared after preview. Transaction cancelled.",
      );
    }

    const result = await tx.product.deleteMany({
      where: { id: { in: idsToDelete } },
    });

    if (result.count !== idsToDelete.length) {
      throw new Error(
        `STOP: Expected to delete ${idsToDelete.length}, deleted ${result.count}. Transaction rolled back.`,
      );
    }
  });

  const remaining = await prisma.product.findMany({
    where: { name: { startsWith: DEMO_PREFIX } },
    select: { name: true, category: true, imageUrl: true },
  });

  const remainingNames = new Set(remaining.map((p) => normalizedName(p.name)));

  if (
    remaining.length !== EXPECTED_UNIQUE_NAMES ||
    remainingNames.size !== EXPECTED_UNIQUE_NAMES
  ) {
    throw new Error(
      `Post-check failed: ${remaining.length} products and ${remainingNames.size} unique names remain. Inspect the backup.`,
    );
  }

  console.log("\nCLEANUP COMPLETE");
  console.log(`Demo products remaining: ${remaining.length}`);
  console.log(`Unique product names remaining: ${remainingNames.size}`);
  console.log("Only duplicate demo records were targeted.");
  console.log("Product images and retained product fields were not modified.");
}

main()
  .catch((error) => {
    console.error("\nCLEANUP STOPPED:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
