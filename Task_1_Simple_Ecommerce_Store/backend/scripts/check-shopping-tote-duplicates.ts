import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const products = await prisma.product.findMany({
    where: {
      vendorId: 'cmw2hxo8000012gmmaduo9qb6',
      name: {
        contains: 'Reusable Shopping Tote',
        mode: 'insensitive',
      },
    },
    include: {
      orderItems: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  console.table(
    products.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
      imageUrl: product.imageUrl,
      orderReferences: product.orderItems.length,
    })),
  );

  console.log('\nTotal matching products:', products.length);
  console.log(
    'Products referenced by orders:',
    products.filter((product) => product.orderItems.length > 0).length,
  );
  console.log(
    'Products safe to delete:',
    products.filter((product) => product.orderItems.length === 0).length,
  );
}

main()
  .catch((error) => {
    console.error('Diagnostic failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });