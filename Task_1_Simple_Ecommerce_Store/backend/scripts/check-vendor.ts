import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    }),
  });

  try {
    const vendors = await prisma.vendor.findMany({
      select: {
        id: true,
        storeName: true,
        applicationStatus: true,
        user: {
          select: {
            email: true,
            role: true,
          },
        },
      },
    });

    console.log('Vendor applications:');
    console.table(
      vendors.map((vendor) => ({
        id: vendor.id,
        storeName: vendor.storeName,
        status: vendor.applicationStatus,
        email: vendor.user.email,
        role: vendor.user.role,
      })),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});