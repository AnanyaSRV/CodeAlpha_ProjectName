
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const KEEP_ID = 'cmw2ihqbw00291whufsdllu00';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

async function main() {
  const vendorId = process.env.DEMO_VENDOR_ID;

  if (!vendorId || !process.env.DATABASE_URL) {
    throw new Error('Missing database configuration.');
  }

  await prisma.$transaction(async (tx) => {
    const duplicates = await tx.product.findMany({
      where: {
        vendorId,
        name: { contains: 'Reusable Shopping Bag' },
        id: { not: KEEP_ID },
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (duplicates.length !== 9) {
      throw new Error(
        `Expected 9 duplicates, found ${duplicates.length}. Nothing deleted.`,
      );
    }

    const orderReferences = await tx.orderItem.count({
      where: {
        productId: { in: duplicates.map((product) => product.id) },
      },
    });

    if (orderReferences > 0) {
      throw new Error(
        'Some duplicate products have order references. Nothing deleted.',
      );
    }

    const result = await tx.product.deleteMany({
      where: {
        vendorId,
        id: { in: duplicates.map((product) => product.id) },
      },
    });

    console.log(`Deleted duplicate products: ${result.count}`);
    console.log(`Retained product ID: ${KEEP_ID}`);
  });

  const remaining = await prisma.product.findMany({
    where: {
      vendorId,
      name: { contains: 'Reusable Shopping Bag' },
    },
    select: {
      id: true,
      name: true,
      imageUrl: true,
    },
  });

  console.log('\nRemaining product:');
  console.table(remaining);
  console.log(`Final count: ${remaining.length}`);
}

main()
  .catch((error) => {
    console.error('Deletion failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
