import 'dotenv/config';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is missing.');

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const prefix = '[MH-DEMO-';
const imageDirectory = join(
  process.cwd(),
  '..',
  'frontend',
  'public',
  'images',
  'fashion',
);

const imageMap: Record<string, string> = {
  'Cotton T-Shirt': '01_cotton_t_shirt.png',
  'Casual Shirt': '02_casual_shirt.png',
  'Everyday Hoodie': '03_everyday_hoodie.png',
  'Classic Denim Jeans': '04_classic_denim_jeans.png',
  'Relaxed Fit Trousers': '05_relaxed_fit_trousers.png',
  'Knit Sweater': '06_knit_sweater.png',
  'Casual Kurta': '07_casual_kurta.png',
};

async function main() {
  // Verify every image exists before connecting changes to products.
  for (const [type, filename] of Object.entries(imageMap)) {
    const path = join(imageDirectory, filename);
    if (!existsSync(path)) {
      throw new Error(`Missing image for ${type}: ${path}`);
    }
  }

  const products = await prisma.product.findMany({
    where: {
      category: 'Fashion',
      name: { startsWith: prefix },
    },
    select: {
      id: true,
      name: true,
      category: true,
      imageUrl: true,
    },
  });

  const groups = new Map<string, typeof products>();
  for (const product of products) {
    const productType = product.name.split('] ').slice(1).join('] ').trim();
    if (!imageMap[productType]) continue;
    const group = groups.get(productType) ?? [];
    group.push(product);
    groups.set(productType, group);
  }

  console.log('\n===== FASHION IMAGE UPDATE PREVIEW =====');
  let total = 0;

  for (const [type, filename] of Object.entries(imageMap)) {
    const matches = groups.get(type) ?? [];
    console.log(`${type}: ${matches.length} products -> /images/fashion/${filename}`);
    if (matches.length !== 10) {
      throw new Error(
        `Safety check failed: expected 10 products for "${type}", found ${matches.length}. Nothing updated.`,
      );
    }
    total += matches.length;
  }

  if (total !== 70) {
    throw new Error(`Expected 70 products, found ${total}. Nothing updated.`);
  }

  console.log(`\nVerified ${total} products and all 7 image files.`);
  console.log('Only imageUrl will be changed.');

  const answer = process.argv[2];
  if (answer !== '--apply') {
    console.log('\nPREVIEW ONLY. To apply after reviewing, run:');
    console.log('.\\node_modules\\.bin\\tsx.cmd .\\prisma\\apply-fashion-ai-images.ts --apply');
    return;
  }

  // Preserve the current image URLs for recovery before any database write.
  const backupDirectory = join(process.cwd(), 'prisma');
  const backupPath = join(
    backupDirectory,
    `fashion-image-url-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );

  mkdirSync(backupDirectory, { recursive: true });
  writeFileSync(
    backupPath,
    JSON.stringify(
      products
        .filter((product) => imageMap[product.name.split('] ').slice(1).join('] ').trim()])
        .map((product) => ({
          id: product.id,
          name: product.name,
          category: product.category,
          imageUrl: product.imageUrl,
        })),
      null,
      2,
    ),
    'utf8',
  );

  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const [type, filename] of Object.entries(imageMap)) {
      const matches = groups.get(type) ?? [];
      const result = await tx.product.updateMany({
        where: {
          id: { in: matches.map((product) => product.id) },
          category: 'Fashion',
          name: { startsWith: prefix },
        },
        data: { imageUrl: `/images/fashion/${filename}` },
      });

      if (result.count !== 10) {
        throw new Error(
          `Update safety check failed for "${type}": updated ${result.count}; transaction will roll back.`,
        );
      }
      updated += result.count;
    }
  });

  console.log(`\nSUCCESS: Updated ${updated} Fashion demo products.`);
  console.log(`Previous image URLs backed up to: ${backupPath}`);
  console.log('No other product fields were modified.');
}

main()
  .catch((error) => {
    console.error('\nFAILED:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
