
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './src/generated/prisma/client.ts';

const PREFIX = '[MH-DEMO-';
const EXPECTED_PRODUCTS = 1000;

type Template = {
  names: string[];
  imageUrls: [string, string];
};

const templates: Template[] = [
  {
    names: [
      'Cotton T-Shirt', 'Casual Shirt', 'Everyday Hoodie',
      'Classic Denim Jeans', 'Summer Dress', 'Relaxed Fit Trousers',
      'Lightweight Jacket', 'Knit Sweater', 'Casual Kurta', 'Linen Top',
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    names: [
      'Canvas Tote Bag', 'Everyday Backpack', 'Laptop Messenger Bag',
      'Travel Duffel Bag', 'Compact Sling Bag', 'Crossbody Bag',
      'Weekend Travel Bag', 'Minimalist Wallet', 'Reusable Shopping Bag',
      'Organizer Pouch',
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    names: [
      'Hardcover Notebook', 'Daily Planner', 'Sketchbook', 'Gel Pen Set',
      'Desk Organizer', 'Sticky Note Set', 'Journal and Pen Kit',
      'Mechanical Pencil Set', 'Document Folder', 'Study Flashcards',
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    names: [
      'Decorative Table Lamp', 'Ceramic Flower Vase', 'Cushion Cover Set',
      'Wall Art Print', 'Decorative Planter', 'Minimalist Wall Clock',
      'Soft Throw Blanket', 'Storage Basket', 'Photo Frame',
      'Decorative Candle Holder',
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    names: [
      'USB-C Charging Cable', 'Wireless Mouse', 'Laptop Stand',
      'Phone Holder', 'Desk Headphone Stand', 'Cable Organizer Kit',
      'Protective Phone Case', 'Compact USB Hub', 'Laptop Sleeve',
      'Portable Desk Light',
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    names: [
      'Yoga Mat', 'Resistance Band Set', 'Training Water Bottle',
      'Workout Gloves', 'Jump Rope', 'Gym Duffel Bag', 'Exercise Towel',
      'Foam Roller', 'Running Belt', 'Stretching Strap',
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    names: [
      'Makeup Organizer', 'Cosmetic Travel Pouch', 'Hair Brush',
      'Makeup Brush Set', 'Compact Vanity Mirror', 'Hair Clip Set',
      'Reusable Makeup Pads', 'Toiletry Organizer', 'Headband Set',
      'Cosmetic Storage Case',
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    names: [
      'Ceramic Coffee Mug', 'Reusable Lunch Box', 'Glass Water Bottle',
      'Kitchen Storage Jar Set', 'Insulated Travel Mug',
      'Cotton Kitchen Towel Set', 'Serving Tray', 'Spice Storage Rack',
      'Reusable Food Container', 'Measuring Cup Set',
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1493857671505-72967e2e2760?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    names: [
      'Compact Travel Umbrella', 'Packing Cube Set', 'Travel Neck Pillow',
      'Reusable Shopping Tote', 'Travel Toiletry Bag', 'Outdoor Picnic Mat',
      'Insulated Travel Bottle', 'Foldable Daypack', 'Luggage Tag Set',
      'Travel Document Wallet',
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    names: [
      'Gift Box Set', 'Scented Candle Jar', 'Greeting Card Set',
      'Decorative Keychain', 'Photo Album', 'Reusable Gift Wrap',
      'Desk Accessory Set', 'Miniature Display Piece', 'Personal Journal',
      'Gift Bag Collection',
    ],
    imageUrls: [
      'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=900&q=85',
    ],
  },
];

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing from backend .env.');
  }

  const imageByType = new Map<string, string>();

  for (const template of templates) {
    template.names.forEach((name, index) => {
      if (imageByType.has(name)) {
        throw new Error(`Duplicate product type in restoration map: ${name}`);
      }

      imageByType.set(
        name,
        template.imageUrls[index % template.imageUrls.length],
      );
    });
  }

  if (imageByType.size !== 100) {
    throw new Error(
      `Expected 100 product types in restoration map; found ${imageByType.size}.`,
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    }),
  });

  try {
    const products = await prisma.product.findMany({
      where: { name: { startsWith: PREFIX } },
      select: { name: true },
    });

    if (products.length !== EXPECTED_PRODUCTS) {
      throw new Error(
        `Expected ${EXPECTED_PRODUCTS} demo products; found ${products.length}. No changes made.`,
      );
    }

    const counts = new Map<string, number>();

    for (const product of products) {
      const type = product.name.replace(/^\[MH-DEMO-\d+\]\s*/, '').trim();

      if (!imageByType.has(type)) {
        throw new Error(
          `No original seed image mapping exists for "${type}". No changes made.`,
        );
      }

      counts.set(type, (counts.get(type) ?? 0) + 1);
    }

    for (const [type, count] of counts) {
      if (count !== 10) {
        throw new Error(
          `Expected 10 products of type "${type}", found ${count}. No changes made.`,
        );
      }
    }

    console.log('Validation passed: 1,000 products and 100 product types.');
    console.log('Restoring the original seed image URLs...');

    let updated = 0;

    await prisma.$transaction(
      async (tx) => {
        for (const [type, imageUrl] of imageByType) {
          const result = await tx.product.updateMany({
            where: {
              name: {
                startsWith: PREFIX,
                endsWith: type,
              },
            },
            data: { imageUrl },
          });

          if (result.count !== 10) {
            throw new Error(
              `Expected 10 updates for "${type}", got ${result.count}.`,
            );
          }

          updated += result.count;
          console.log(`${type}: restored ${result.count} images`);
        }

        if (updated !== EXPECTED_PRODUCTS) {
          throw new Error(
            `Expected ${EXPECTED_PRODUCTS} updates; got ${updated}.`,
          );
        }
      },
      { maxWait: 10000, timeout: 120000 },
    );

    console.log(`SUCCESS: Restored ${updated} product image URLs.`);
    console.log(
      'Only imageUrl was changed. No products were created or deleted.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    'Image restoration failed:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
