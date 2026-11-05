import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

async function main() {
  const products = await prisma.product.findMany({
    where: {
      vendorId: process.env.DEMO_VENDOR_ID,
      name: { startsWith: '[MH-DEMO-' },
    },
    select: {
      name: true,
      category: true,
      imageUrl: true,
    },
    take: 25,
  });

  console.table(products);

  const categories = await prisma.product.groupBy({
    by: ['category'],
    where: {
      vendorId: process.env.DEMO_VENDOR_ID,
      name: { startsWith: '[MH-DEMO-' },
    },
    _count: { id: true },
  });

  console.log('\nProduct categories:');
  console.table(categories);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });