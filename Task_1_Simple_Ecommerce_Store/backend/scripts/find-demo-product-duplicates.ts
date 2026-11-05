
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const VENDOR_ID = 'cmw2hxo8000012gmmaduo9qb6';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

interface ProductRecord {
  id: string;
  name: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  orderReferences: number;
}

function normalizeName(name: string): string {
  return name
    .replace(/^\[MH-DEMO-\d+\]\s*/i, '')
    .trim()
    .toLowerCase();
}

async function main() {
  const products = await prisma.product.findMany({
    where: {
      vendorId: VENDOR_ID,
    },
    select: {
      id: true,
      name: true,
      price: true,
      stock: true,
      imageUrl: true,
      _count: {
        select: {
          orderItems: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  const records: ProductRecord[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    price: Number(product.price),
    stock: product.stock,
    imageUrl: product.imageUrl,
    orderReferences: product._count.orderItems,
  }));

  // Group products by normalized name.
  const nameGroups = new Map<string, ProductRecord[]>();

  for (const product of records) {
    const key = normalizeName(product.name);

    const group = nameGroups.get(key) ?? [];
    group.push(product);
    nameGroups.set(key, group);
  }

  const duplicateNameGroups = [...nameGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log('\n========== CATALOGUE SUMMARY ==========');
  console.log('Total demo products:', records.length);
  console.log('Unique normalized product names:', nameGroups.size);
  console.log('Duplicate name groups:', duplicateNameGroups.length);

  console.log('\n========== DUPLICATE PRODUCT NAMES ==========');

  if (duplicateNameGroups.length === 0) {
    console.log('No duplicate product names found.');
  }

  for (const [name, group] of duplicateNameGroups) {
    console.log(`\nProduct: ${name}`);
    console.log(`Number of listings: ${group.length}`);

    console.table(
      group.map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        stock: product.stock,
        imageUrl: product.imageUrl,
        orderReferences: product.orderReferences,
      })),
    );
  }

  // Group products by image URL.
  const imageGroups = new Map<string, ProductRecord[]>();

  for (const product of records) {
    if (!product.imageUrl) continue;

    const group = imageGroups.get(product.imageUrl) ?? [];
    group.push(product);
    imageGroups.set(product.imageUrl, group);
  }

  const duplicateImageGroups = [...imageGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log('\n========== REPEATED PRODUCT IMAGES ==========');
  console.log('Repeated image groups:', duplicateImageGroups.length);

  for (const [imageUrl, group] of duplicateImageGroups) {
    console.log(`\nImage: ${imageUrl}`);
    console.log(`Products using this image: ${group.length}`);

    console.table(
      group.map((product) => ({
        id: product.id,
        name: product.name,
        orderReferences: product.orderReferences,
      })),
    );
  }

  const duplicateProducts = duplicateNameGroups.flatMap(
    ([, group]) => group.length - 1,
  );

  console.log('\n========== FINAL AUDIT ==========');
  console.log('Total products:', records.length);
  console.log('Duplicate name groups:', duplicateNameGroups.length);
  console.log('Extra listings in duplicate groups:', duplicateProducts);
  console.log('Repeated image groups:', duplicateImageGroups.length);
  console.log('\nNo products were modified or deleted.');
}

main()
  .catch((error) => {
    console.error('Duplicate audit failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
