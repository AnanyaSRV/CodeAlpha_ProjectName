import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './src/generated/prisma/client.ts';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is missing');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

try {
  const products = await prisma.product.findMany({
    where: { name: { startsWith: '[MH-DEMO-' } },
    select: { name: true, category: true, imageUrl: true },
    orderBy: { name: 'asc' },
    take: 30,
  });

  for (const p of products) {
    console.log(`${p.category} | ${p.name} | ${p.imageUrl}`);
  }

  const counts = await prisma.product.groupBy({
    by: ['imageUrl'],
    where: { name: { startsWith: '[MH-DEMO-' } },
    _count: { imageUrl: true },
  });

  console.log('\nTotal distinct image URLs:', counts.length);
  console.log('Most reused URLs:');
  for (const item of counts.sort((a, b) => b._count.imageUrl - a._count.imageUrl).slice(0, 10)) {
    console.log(`${item._count.imageUrl} products | ${item.imageUrl}`);
  }
} finally {
  await prisma.$disconnect();
}
