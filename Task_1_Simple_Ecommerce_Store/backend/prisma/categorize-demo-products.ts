
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const VENDOR_ID = 'cmw2hxo8000012gmmaduo9qb6';
const EXPECTED_PRODUCT_COUNT = 100;
const PREFIX = /^\[MH-DEMO-\d{4}\]\s*/;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is missing. Check backend/.env.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const categoryGroups: Record<string, string[]> = {
  Fashion: [
    'Cotton T-Shirt',
    'Casual Shirt',
    'Everyday Hoodie',
    'Classic Denim Jeans',
    'Summer Dress',
    'Relaxed Fit Trousers',
    'Lightweight Jacket',
    'Knit Sweater',
    'Casual Kurta',
    'Linen Top',
  ],

  Bags: [
    'Canvas Tote Bag',
    'Everyday Backpack',
    'Laptop Messenger Bag',
    'Travel Duffel Bag',
    'Compact Sling Bag',
    'Crossbody Bag',
    'Weekend Travel Bag',
    'Minimalist Wallet',
    'Reusable Shopping Bag',
    'Organizer Pouch',
  ],

  Stationery: [
    'Hardcover Notebook',
    'Daily Planner',
    'Sketchbook',
    'Gel Pen Set',
    'Desk Organizer',
    'Sticky Note Set',
    'Journal and Pen Kit',
    'Mechanical Pencil Set',
    'Document Folder',
    'Study Flashcards',
  ],

  'Home Decor': [
    'Decorative Table Lamp',
    'Ceramic Flower Vase',
    'Cushion Cover Set',
    'Wall Art Print',
    'Decorative Planter',
    'Minimalist Wall Clock',
    'Soft Throw Blanket',
    'Storage Basket',
    'Photo Frame',
    'Decorative Candle Holder',
  ],

  'Electronics Accessories': [
    'USB-C Charging Cable',
    'Wireless Mouse',
    'Laptop Stand',
    'Phone Holder',
    'Desk Headphone Stand',
    'Cable Organizer Kit',
    'Protective Phone Case',
    'Compact USB Hub',
    'Laptop Sleeve',
    'Portable Desk Light',
  ],

  Fitness: [
    'Yoga Mat',
    'Resistance Band Set',
    'Training Water Bottle',
    'Workout Gloves',
    'Jump Rope',
    'Gym Duffel Bag',
    'Exercise Towel',
    'Foam Roller',
    'Running Belt',
    'Stretching Strap',
  ],

  'Beauty Accessories': [
    'Makeup Organizer',
    'Cosmetic Travel Pouch',
    'Hair Brush',
    'Makeup Brush Set',
    'Compact Vanity Mirror',
    'Hair Clip Set',
    'Reusable Makeup Pads',
    'Toiletry Organizer',
    'Headband Set',
    'Cosmetic Storage Case',
  ],

  Kitchen: [
    'Ceramic Coffee Mug',
    'Reusable Lunch Box',
    'Glass Water Bottle',
    'Kitchen Storage Jar Set',
    'Insulated Travel Mug',
    'Cotton Kitchen Towel Set',
    'Serving Tray',
    'Spice Storage Rack',
    'Reusable Food Container',
    'Measuring Cup Set',
  ],

  'Outdoor and Travel': [
    'Compact Travel Umbrella',
    'Packing Cube Set',
    'Travel Neck Pillow',
    'Reusable Shopping Tote',
    'Travel Toiletry Bag',
    'Outdoor Picnic Mat',
    'Insulated Travel Bottle',
    'Foldable Daypack',
    'Luggage Tag Set',
    'Travel Document Wallet',
  ],

  'Gifts and Lifestyle': [
    'Gift Box Set',
    'Scented Candle Jar',
    'Greeting Card Set',
    'Decorative Keychain',
    'Photo Album',
    'Reusable Gift Wrap',
    'Desk Accessory Set',
    'Miniature Display Piece',
    'Personal Journal',
    'Gift Bag Collection',
  ],
};

async function main() {
  console.log('Starting MarketHub demo product categorization...');

  const categoryByName = new Map<string, string>();

  for (const [category, names] of Object.entries(categoryGroups)) {
    for (const name of names) {
      if (categoryByName.has(name)) {
        throw new Error(`Duplicate mapping found for product: ${name}`);
      }

      categoryByName.set(name, category);
    }
  }

  if (categoryByName.size !== EXPECTED_PRODUCT_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_PRODUCT_COUNT} mapped product names, found ${categoryByName.size}.`,
    );
  }

  const products = await prisma.product.findMany({
    where: {
      vendorId: VENDOR_ID,
      name: { startsWith: '[MH-DEMO-' },
    },
    select: {
      id: true,
      name: true,
      category: true,
    },
    orderBy: { name: 'asc' },
  });

  console.log(`Products found: ${products.length}`);

  if (products.length !== EXPECTED_PRODUCT_COUNT) {
    throw new Error(
      `Expected exactly ${EXPECTED_PRODUCT_COUNT} demo products, found ${products.length}. No changes made.`,
    );
  }

  const seenNames = new Set<string>();
  const updates: { id: string; category: string }[] = [];

  for (const product of products) {
    const productName = product.name.replace(PREFIX, '').trim();
    const expectedCategory = categoryByName.get(productName);

    if (!expectedCategory) {
      throw new Error(
        `No category mapping found for "${product.name}". No changes made.`,
      );
    }

    if (seenNames.has(productName)) {
      throw new Error(
        `Duplicate product name found: "${productName}". No changes made.`,
      );
    }

    seenNames.add(productName);

    if (
      product.category !== 'Uncategorized' &&
      product.category !== expectedCategory
    ) {
      throw new Error(
        `Unexpected existing category for "${product.name}": "${product.category}". Expected "${expectedCategory}". No changes made.`,
      );
    }

    if (product.category !== expectedCategory) {
      updates.push({
        id: product.id,
        category: expectedCategory,
      });
    }
  }

  if (seenNames.size !== EXPECTED_PRODUCT_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_PRODUCT_COUNT} unique products, found ${seenNames.size}. No changes made.`,
    );
  }

  console.log('\n========== PRE-UPDATE SUMMARY ==========');
  console.log(`Products verified: ${products.length}`);
  console.log(`Unique product names: ${seenNames.size}`);
  console.log(`Categories defined: ${Object.keys(categoryGroups).length}`);
  console.log(`Products requiring updates: ${updates.length}`);

  for (const [category, names] of Object.entries(categoryGroups)) {
    console.log(`${category}: ${names.length} product types`);
  }

  if (updates.length > 0) {
    await prisma.$transaction(
      async (tx) => {
        for (const update of updates) {
          const result = await tx.product.updateMany({
            where: {
              id: update.id,
              vendorId: VENDOR_ID,
              category: 'Uncategorized',
            },
            data: {
              category: update.category,
            },
          });

          if (result.count !== 1) {
            throw new Error(
              `Expected to update exactly one product with ID ${update.id}, updated ${result.count}.`,
            );
          }
        }
      },
      {
        maxWait: 30000,
        timeout: 60000,
      },
    );
  }

  const finalProducts = await prisma.product.findMany({
    where: {
      vendorId: VENDOR_ID,
      name: { startsWith: '[MH-DEMO-' },
    },
    select: {
      name: true,
      category: true,
    },
  });

  const incorrectProducts = finalProducts.filter((product) => {
    const name = product.name.replace(PREFIX, '').trim();
    return categoryByName.get(name) !== product.category;
  });

  if (
    finalProducts.length !== EXPECTED_PRODUCT_COUNT ||
    incorrectProducts.length > 0
  ) {
    throw new Error(
      `Final verification failed. Products: ${finalProducts.length}; incorrect categories: ${incorrectProducts.length}.`,
    );
  }

  console.log('\n========== FINAL CATEGORY SUMMARY ==========');

  for (const category of Object.keys(categoryGroups)) {
    const count = finalProducts.filter(
      (product) => product.category === category,
    ).length;

    console.log(`${category}: ${count} products`);
  }

  console.log('\nSUCCESS: All 100 demo products are correctly categorized.');
}

main()
  .catch((error) => {
    console.error('\nCATEGORY REPAIR FAILED:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
