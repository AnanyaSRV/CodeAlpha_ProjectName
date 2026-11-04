import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const products = await prisma.product.findMany({
    where: { name: { startsWith: '[MH-DEMO-' } },
    select: { name: true, description: true, imageUrl: true },
    orderBy: { name: 'asc' },
  });

  for (const p of products) {
    if (/Cotton T-Shirt|Casual Shirt|Everyday Hoodie|Classic Denim Jeans|Knit Sweater|Casual Kurta|Relaxed Fit Trousers/i.test(p.name)) {
      console.log(`${p.name} | ${p.imageUrl}`);
    }
  }
} finally {
  await prisma.$disconnect();
}

