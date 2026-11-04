import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is missing.');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const products = await prisma.product.findMany({
    where: { name: { startsWith: '[MH-DEMO-' } },
    select: {
      id: true,
      name: true,
      category: true,
      description: true,
      imageUrl: true,
      price: true,
      stock: true,
      active: true,
      _count: { select: { orderItems: true } },
    },
    orderBy: { name: 'asc' },
  });

  const byName = new Map<string, typeof products>();
  for (const p of products) {
    const cleanName = p.name.replace(/^\[MH-DEMO-\d+\]\s*/, '').trim().toLowerCase();
    const group = byName.get(cleanName) ?? [];
    group.push(p);
    byName.set(cleanName, group);
  }

  const duplicateNames = [...byName.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([normalizedName, group]) => ({
      normalizedName,
      count: group.length,
      products: group.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        imageUrl: p.imageUrl,
        orderItemCount: p._count.orderItems,
      })),
    }));

  const imageGroups = new Map<string, typeof products>();
  for (const p of products) {
    const url = p.imageUrl ?? '(no image)';
    const group = imageGroups.get(url) ?? [];
    group.push(p);
    imageGroups.set(url, group);
  }

  const repeatedImages = [...imageGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([imageUrl, group]) => ({
      imageUrl,
      count: group.length,
      products: group.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        orderItemCount: p._count.orderItems,
      })),
    }));

  const report = {
    generatedAt: new Date().toISOString(),
    totalDemoProducts: products.length,
    duplicateNameGroups: duplicateNames.length,
    productsInDuplicateNameGroups: duplicateNames.reduce((n, g) => n + g.count, 0),
    uniqueImageUrls: imageGroups.size,
    repeatedImageGroups: repeatedImages.length,
    productsWithOrderReferences: products.filter((p) => p._count.orderItems > 0).length,
    duplicateNames,
    repeatedImages,
    allProducts: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      imageUrl: p.imageUrl,
      price: p.price,
      stock: p.stock,
      active: p.active,
      orderItemCount: p._count.orderItems,
    })),
  };

  const outPath = join(process.cwd(), 'prisma', 'demo-product-cleanup-audit.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n===== READ-ONLY DEMO PRODUCT AUDIT =====');
  console.log(`Total demo products: ${report.totalDemoProducts}`);
  console.log(`Duplicate-name groups: ${report.duplicateNameGroups}`);
  console.log(`Products in duplicate-name groups: ${report.productsInDuplicateNameGroups}`);
  console.log(`Unique image URLs: ${report.uniqueImageUrls}`);
  console.log(`Repeated-image groups: ${report.repeatedImageGroups}`);
  console.log(`Products referenced by order items: ${report.productsWithOrderReferences}`);
  console.log(`\nReport saved to: ${outPath}`);
  console.log('\nNo products or database records were changed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
