
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
      name: { contains: 'Reusable Shopping Bag' },
    },
    select: {
      id: true,
      name: true,
      price: true,
      stock: true,
      imageUrl: true,
    },
    orderBy: { name: 'asc' },
  });

  console.table(products);
  console.log(`Total matching products: ${products.length}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
