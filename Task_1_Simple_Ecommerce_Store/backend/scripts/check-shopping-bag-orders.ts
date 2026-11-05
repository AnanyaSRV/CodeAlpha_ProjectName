
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

const KEEP_ID = 'cmw2ihqbw00291whufsdllu00';

async function main() {
  const products = await prisma.product.findMany({
    where: {
      vendorId: process.env.DEMO_VENDOR_ID,
      name: { contains: 'Reusable Shopping Bag' },
      id: { not: KEEP_ID },
    },
    select: {
      id: true,
      name: true,
      orderItems: {
        select: {
          id: true,
          orderId: true,
        },
      },
    },
  });

  console.log('\n========== DUPLICATE ORDER CHECK ==========');

  for (const product of products) {
    console.log({
      product: product.name,
      productId: product.id,
      orderReferences: product.orderItems.length,
    });
  }

  const referenced = products.filter(
    (product) => product.orderItems.length > 0,
  );

  console.log('\nDuplicates:', products.length);
  console.log('Referenced by orders:', referenced.length);
  console.log(
    'Safe to delete:',
    products.length - referenced.length,
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
