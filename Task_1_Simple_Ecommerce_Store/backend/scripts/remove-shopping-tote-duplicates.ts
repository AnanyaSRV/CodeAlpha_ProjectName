import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const VENDOR_ID = 'cmw2hxo8000012gmmaduo9qb6';
const KEEP_ID = 'cmw2ihqbv00121whuyll91z13';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

async function main() {
  const result = await prisma.$transaction(
    async (tx) => {
      const duplicates = await tx.product.findMany({
        where: {
          vendorId: VENDOR_ID,
          name: {
            contains: 'Reusable Shopping Tote',
            mode: 'insensitive',
          },
          id: {
            not: KEEP_ID,
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicates.length !== 9) {
        throw new Error(
          `Safety check failed: expected 9 duplicates, found ${duplicates.length}.`,
        );
      }

      const duplicateIds = duplicates.map((product) => product.id);

      const orderReferences = await tx.orderItem.count({
        where: {
          productId: {
            in: duplicateIds,
          },
        },
      });

      if (orderReferences > 0) {
        throw new Error(
          `Safety check failed: ${orderReferences} order references found.`,
        );
      }

      return await tx.product.deleteMany({
        where: {
          vendorId: VENDOR_ID,
          id: {
            in: duplicateIds,
          },
        },
      });
    },
    {
      maxWait: 30000,
      timeout: 60000,
    },
  );

  console.log('Deleted duplicate products:', result.count);

  const remaining = await prisma.product.findMany({
    where: {
      vendorId: VENDOR_ID,
      name: {
        contains: 'Reusable Shopping Tote',
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      name: true,
      imageUrl: true,
    },
  });

  console.log('\nRemaining products:');
  console.table(remaining);
  console.log('Final count:', remaining.length);
}

main()
  .catch((error) => {
    console.error('Deletion failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });