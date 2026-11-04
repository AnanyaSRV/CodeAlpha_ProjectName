import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const products = await prisma.product.findMany({
    where: { name: { startsWith: "[MH-DEMO-" } },
    select: { id: true, name: true, category: true, imageUrl: true },
    orderBy: { name: "asc" },
  });

  if (products.length !== 100) {
    throw new Error(`Expected 100 demo products; found ${products.length}.`);
  }

  const groups = new Map();

  for (const product of products) {
    if (!product.imageUrl) continue;
    const list = groups.get(product.imageUrl) ?? [];
    list.push(product);
    groups.set(product.imageUrl, list);
  }

  const repeatedImages = [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([imageUrl, items]) => ({ imageUrl, products: items }));

  const reportPath = path.join("prisma", "repeated-demo-image-report.json");
  fs.writeFileSync(
    reportPath,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      totalDemoProducts: products.length,
      repeatedImageGroups: repeatedImages.length,
      repeatedImages,
    }, null, 2),
    "utf8"
  );

  console.log(`Demo products checked: ${products.length}`);
  console.log(`Repeated image groups: ${repeatedImages.length}`);
  console.log(`Report saved: ${reportPath}`);
  for (const group of repeatedImages) {
    console.log(`\n${group.products.length} products share: ${group.imageUrl}`);
    for (const product of group.products) {
      console.log(`  ${product.name} | ${product.category}`);
    }
  }
} finally {
  await prisma.$disconnect();
}
