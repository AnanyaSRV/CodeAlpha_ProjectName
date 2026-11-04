import 'dotenv/config';
import { PrismaClient } from './src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is missing.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const corrections = [
  {
    id: 'cmvt6d1r8000icchugf4638lk',
    name: '[MH-DEMO-0019] Packing Cube Set',
    imageUrl:
      'https://images.pexels.com/photos/18999368/pexels-photo-18999368.jpeg?cs=srgb&dl=pexels-bertellifotografia-18999368.jpg&fm=jpg',
  },
  {
    id: 'cmvt6d1r8000scchucl69uu3u',
    name: '[MH-DEMO-0029] Travel Neck Pillow',
    imageUrl:
      'https://images.pexels.com/photos/25210705/pexels-photo-25210705.jpeg?cs=srgb&dl=pexels-taylor-thompson-865581658-25210705.jpg&fm=jpg',
  },
  {
    id: 'cmvt6d1r8000wcchubxvcan49',
    name: '[MH-DEMO-0033] Gel Pen Set',
    imageUrl:
      'https://images.pexels.com/photos/7718804/pexels-photo-7718804.jpeg?cs=srgb&dl=pexels-mart-production-7718804.jpg&fm=jpg',
  },
  {
    id: 'cmvt6d1r9001ccchupwxhrhty',
    name: '[MH-DEMO-0049] Travel Toiletry Bag',
    imageUrl:
      'https://images.unsplash.com/photo-1765516976457-550bd5f6f708?auto=format&fit=crop&fm=jpg&ixid=NHwxMjA3fDA%3D&ixlib=rb-4.1.0&q=60&w=3000',
  },
  {
    id: 'cmvt6d1r9001dcchub21qpvgv',
    name: '[MH-DEMO-0050] Photo Album',
    imageUrl:
      'https://images.unsplash.com/photo-1677658288237-2fff291a34f0?auto=format&fit=crop&fm=jpg&ixid=NHwxMjA3fDA%3D&ixlib=rb-4.1.0&q=60&w=3000',
  },
  {
    id: 'cmvt6d1r9001ecchu2cvke5y9',
    name: '[MH-DEMO-0051] Relaxed Fit Trousers',
    imageUrl:
      'https://images.unsplash.com/photo-1789110519338-8b8d7f35872a?auto=format&fit=crop&fm=jpg&ixid=NHwxMjA3fDA%3D&ixlib=rb-4.1.0&q=60&w=3000',
  },
];

async function main() {
  // Validate every target before changing any records.
  for (const item of corrections) {
    const product = await prisma.product.findUnique({
      where: { id: item.id },
      select: { id: true, name: true },
    });

    if (!product || product.name !== item.name) {
      throw new Error(
        `Validation failed for ${item.name}. No image updates were started.`,
      );
    }
  }

  // Update only the six validated products.
  await prisma.$transaction(
    corrections.map((item) =>
      prisma.product.update({
        where: { id: item.id },
        data: { imageUrl: item.imageUrl },
      }),
    ),
  );

  const updated = await prisma.product.findMany({
    where: {
      id: { in: corrections.map((item) => item.id) },
    },
    select: { id: true, name: true, imageUrl: true },
    orderBy: { name: 'asc' },
  });

  console.table(
    updated.map((product) => ({
      name: product.name,
      id: product.id,
      imageUrl: product.imageUrl,
    })),
  );

  console.log(`Updated ${updated.length} product images.`);
}

main()
  .catch((error) => {
    console.error('Image correction failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
