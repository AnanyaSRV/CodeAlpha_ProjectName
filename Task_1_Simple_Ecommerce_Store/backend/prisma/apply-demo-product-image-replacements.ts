import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const frontendPublic = path.resolve("../frontend/public");

const categoryFolders = {
  "Bags": "bags",
  "Stationery": "stationery",
  "Home Decor": "home",
  "Electronics Accessories": "electronics",
  "Fitness": "fitness",
  "Beauty Accessories": "beauty",
  "Kitchen": "kitchen",
  "Outdoor and Travel": "travel",
  "Gifts and Lifestyle": "gifts",
  "Fashion": "fashion",
};

const preservedFashionNumbers = new Set([
  "0001", "0011", "0021", "0031", "0051", "0071", "0081"
]);

try {
  const products = await prisma.product.findMany({
    where: { name: { startsWith: "[MH-DEMO-" } },
    select: { id: true, name: true, category: true, imageUrl: true },
    orderBy: { name: "asc" },
  });

  if (products.length !== 100) {
    throw new Error(`Expected 100 demo products; found ${products.length}.`);
  }

  const updates = [];
  const fashionPreserved = [];

  for (const product of products) {
    const match = product.name.match(/^\[MH-DEMO-(\d{4})\]/);
    if (!match) throw new Error(`Unexpected demo product name: ${product.name}`);

    const number = match[1];

    if (preservedFashionNumbers.has(number)) {
      if (!product.imageUrl?.startsWith("/images/fashion/")) {
        throw new Error(`Expected existing Fashion image for ${product.name}`);
      }
      const existingFile = path.join(frontendPublic, product.imageUrl.replace(/^\//, ""));
      if (!fs.existsSync(existingFile)) {
        throw new Error(`Existing Fashion image file missing: ${existingFile}`);
      }
      fashionPreserved.push(product.name);
      continue;
    }

    const folder = categoryFolders[product.category];
    if (!folder) throw new Error(`Unknown category "${product.category}" for ${product.name}`);

    const relativeUrl = `/images/products/${folder}/${number}.svg`;
    const absoluteFile = path.join(frontendPublic, relativeUrl.replace(/^\//, ""));

    if (!fs.existsSync(absoluteFile)) {
      throw new Error(`Image file missing for ${product.name}: ${absoluteFile}`);
    }

    updates.push({
      id: product.id,
      name: product.name,
      oldImageUrl: product.imageUrl,
      newImageUrl: relativeUrl,
    });
  }

  if (updates.length !== 93 || fashionPreserved.length !== 7) {
    throw new Error(`Safety check failed: ${updates.length} updates, ${fashionPreserved.length} preserved.`);
  }

  const urlSet = new Set(updates.map((item) => item.newImageUrl));
  if (urlSet.size !== updates.length) {
    throw new Error("Duplicate replacement image paths detected. No changes made.");
  }

  const backupPath = path.join(
    "prisma",
    `demo-product-image-url-before-update-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  fs.writeFileSync(
    backupPath,
    JSON.stringify({ createdAt: new Date().toISOString(), updates }, null, 2),
    "utf8"
  );

await prisma.$transaction(
  async (tx) => {
    for (const item of updates) {
      await tx.product.update({
        where: { id: item.id },
        data: { imageUrl: item.newImageUrl },
      });
    }
  },
  {
    maxWait: 10000,
    timeout: 60000,
  }
);

  const finalProducts = await prisma.product.findMany({
    where: { name: { startsWith: "[MH-DEMO-" } },
    select: { name: true, category: true, imageUrl: true },
  });

  const broken = finalProducts.filter((p) => {
    const file = path.join(frontendPublic, (p.imageUrl ?? "").replace(/^\//, ""));
    return !p.imageUrl || !fs.existsSync(file);
  });

  const repeated = new Map();
  for (const p of finalProducts) {
    repeated.set(p.imageUrl, (repeated.get(p.imageUrl) ?? 0) + 1);
  }
  const duplicatePaths = [...repeated.entries()].filter(([, count]) => count > 1);

  console.log("IMAGE URL UPDATE COMPLETE");
  console.log(`Demo products: ${finalProducts.length}`);
  console.log(`Updated image URLs: ${updates.length}`);
  console.log(`Preserved existing Fashion images: ${fashionPreserved.length}`);
  console.log(`Missing image files: ${broken.length}`);
  console.log(`Repeated image paths: ${duplicatePaths.length}`);
  console.log(`Pre-update URL backup: ${backupPath}`);

  if (broken.length) {
    console.log("Products with missing files:");
    for (const p of broken) console.log(`  ${p.name} -> ${p.imageUrl}`);
    process.exitCode = 1;
  }
  if (duplicatePaths.length) {
    console.log("Repeated paths:");
    for (const [url, count] of duplicatePaths) console.log(`  ${count} products -> ${url}`);
  }
} finally {
  await prisma.$disconnect();
}
