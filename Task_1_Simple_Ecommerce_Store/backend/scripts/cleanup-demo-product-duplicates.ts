
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const VENDOR_ID = 'cmw2hxo8000012gmmaduo9qb6';

const EXPECTED_PRODUCTS = 982;
const EXPECTED_UNIQUE_NAMES = 100;
const EXPECTED_DELETIONS = 882;

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

function normalizeName(name: string): string {
  return name
    .replace(/^\[MH-DEMO-\d+\]\s*/i, '')
    .trim()
    .toLowerCase();
}

function getProductNumber(name: string): number {
  const match = name.match(/^\[MH-DEMO-(\d+)\]/i);

  if (!match) {
    throw new Error(`Unexpected product name format: ${name}`);
  }

  return Number(match[1]);
}

async function main() {
  console.log('Starting demo product duplicate cleanup...');

  const products = await prisma.product.findMany({
    where: {
      vendorId: VENDOR_ID,
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          orderItems: true,
        },
      },
    },
  });

  console.log('Current product count:', products.length);

  if (products.length !== EXPECTED_PRODUCTS) {
    throw new Error(
      `Safety check failed: expected ${EXPECTED_PRODUCTS} products, found ${products.length}. Nothing deleted.`,
    );
  }

  const groups = new Map<string, typeof products>();

  for (const product of products) {
    const key = normalizeName(product.name);
    const group = groups.get(key) ?? [];

    group.push(product);
    groups.set(key, group);
  }

  if (groups.size !== EXPECTED_UNIQUE_NAMES) {
    throw new Error(
      `Safety check failed: expected ${EXPECTED_UNIQUE_NAMES} unique names, found ${groups.size}. Nothing deleted.`,
    );
  }

  const keepIds: string[] = [];
  const deleteIds: string[] = [];

  for (const [name, group] of groups.entries()) {
    const sorted = [...group].sort(
      (a, b) => getProductNumber(a.name) - getProductNumber(b.name),
    );

    keepIds.push(sorted[0].id);

    for (const duplicate of sorted.slice(1)) {
      if (duplicate._count.orderItems > 0) {
        throw new Error(
          `Safety check failed: ${duplicate.name} has order history. Nothing deleted.`,
        );
      }

      deleteIds.push(duplicate.id);
    }

    console.log(
      `${name}: keeping ${sorted[0].name}, removing ${sorted.length - 1}`,
    );
  }

  if (deleteIds.length !== EXPECTED_DELETIONS) {
    throw new Error(
      `Safety check failed: expected ${EXPECTED_DELETIONS} deletions, found ${deleteIds.length}. Nothing deleted.`,
    );
  }

  console.log('\n========== PRE-DELETE SUMMARY ==========');
  console.log('Products to retain:', keepIds.length);
  console.log('Products to delete:', deleteIds.length);
  console.log('Order-linked deletion candidates: 0');

  const result = await prisma.$transaction(
    async (tx) => {
      // Recheck order references inside the transaction.
      const orderReferences = await tx.orderItem.count({
        where: {
          productId: {
            in: deleteIds,
          },
        },
      });

      if (orderReferences > 0) {
        throw new Error(
          `Deletion aborted: ${orderReferences} order references found.`,
        );
      }

      return await tx.product.deleteMany({
        where: {
          vendorId: VENDOR_ID,
          id: {
            in: deleteIds,
          },
        },
      });
    },
    {
      maxWait: 30000,
      timeout: 60000,
    },
  );

  console.log('\nDeleted products:', result.count);

  if (result.count !== EXPECTED_DELETIONS) {
    throw new Error(
      `Unexpected deletion count: ${result.count}. Please inspect the database.`,
    );
  }

  const remaining = await prisma.product.findMany({
    where: {
      vendorId: VENDOR_ID,
    },
    select: {
      id: true,
      name: true,
    },
  });

  const remainingGroups = new Map<string, number>();

  for (const product of remaining) {
    const key = normalizeName(product.name);

    remainingGroups.set(
      key,
      (remainingGroups.get(key) ?? 0) + 1,
    );
  }

  const remainingDuplicates = [...remainingGroups.entries()].filter(
    ([, count]) => count > 1,
  );

  console.log('\n========== FINAL VERIFICATION ==========');
  console.log('Remaining products:', remaining.length);
  console.log('Unique product names:', remainingGroups.size);
  console.log('Remaining duplicate groups:', remainingDuplicates.length);

  if (
    remaining.length !== EXPECTED_UNIQUE_NAMES ||
    remainingGroups.size !== EXPECTED_UNIQUE_NAMES ||
    remainingDuplicates.length !== 0
  ) {
    throw new Error(
      'Final verification failed. Please inspect the database.',
    );
  }

  console.log('\nSUCCESS: Catalogue cleanup completed.');
  console.log('Exactly 100 unique demo products remain.');
}

main()
  .catch((error) => {
    console.error('\nCLEANUP FAILED:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
