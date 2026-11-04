import 'dotenv/config';
import { PrismaClient } from './src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is missing');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const names = [
  '[MH-DEMO-0019]',
  '[MH-DEMO-0029]',
  '[MH-DEMO-0033]',
  '[MH-DEMO-0049]',
  '[MH-DEMO-0050]',
  '[MH-DEMO-0051]',
];

try {
  const products = await prisma.product.findMany({
    where: {
      name: { startsWith: '[MH-DEMO-' },
      OR: names.map((prefix) => ({
        name: { startsWith: prefix },
      })),
    },
    select: { id: true, name: true, imageUrl: true },
    orderBy: { name: 'asc' },
  });

  console.table(products);
} finally {
  await prisma.$disconnect();
}
