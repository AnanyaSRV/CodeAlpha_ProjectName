import 'dotenv/config';
import { PrismaClient } from './src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is missing');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

try {
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, createdAt: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take: 10,
  });

  console.table(products.map(p => ({
    name: p.name,
    id: p.id,
    createdAt: p.createdAt.toISOString(),
  })));
} finally {
  await prisma.$disconnect();
}
