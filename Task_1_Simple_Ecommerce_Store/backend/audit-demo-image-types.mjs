import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { PrismaClient } from './src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is missing');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function csv(value) {
  return '"' + String(value ?? '').replace(/"/g, '""') + '"';
}

async function main() {
  const products = await prisma.product.findMany({
    where: { name: { startsWith: '[MH-DEMO-' } },
    select: { name: true, imageUrl: true },
    orderBy: { name: 'asc' },
  });

  const types = new Map();

  for (const product of products) {
    const type = product.name.replace(/^\[MH-DEMO-\d+\]\s*/, '').trim();

    if (!types.has(type)) {
      types.set(type, { type, count: 0, urls: new Set(), missing: 0 });
    }

    const entry = types.get(type);
    entry.count++;

    if (product.imageUrl?.trim()) {
      entry.urls.add(product.imageUrl);
    } else {
      entry.missing++;
    }
  }

  const rows = [...types.values()]
    .sort((a, b) => a.type.localeCompare(b.type))
    .map((entry) => ({
      productType: entry.type,
      productCount: entry.count,
      distinctImageUrls: entry.urls.size,
      missingImages: entry.missing,
      imageUrls: [...entry.urls].join(' || '),
    }));

  const headers = [
    'productType',
    'productCount',
    'distinctImageUrls',
    'missingImages',
    'imageUrls',
  ];

  await writeFile(
    '.\\demo-image-types.csv',
    [
      headers.map(csv).join(','),
      ...rows.map((row) => headers.map((key) => csv(row[key])).join(',')),
    ].join('\r\n'),
    'utf8',
  );

  console.log('Distinct product types:', rows.length);
  console.log('Report saved to backend\\demo-image-types.csv');
  console.table(rows.map(({ productType, productCount, distinctImageUrls, missingImages }) => ({
    productType,
    productCount,
    distinctImageUrls,
    missingImages,
  })));
}

main()
  .catch((error) => {
    console.error('Report failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
