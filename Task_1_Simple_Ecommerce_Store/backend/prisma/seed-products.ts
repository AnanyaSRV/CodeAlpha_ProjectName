
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const PRODUCT_COUNT = 1000;
const SEED_PREFIX = '[MH-DEMO-';
const DEMO_VENDOR_STORE = process.env.DEMO_VENDOR_STORE ?? 'MarketHub Demo Store';
const DEMO_VENDOR_ID = process.env.DEMO_VENDOR_ID;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is missing. Check that your backend .env file exists.',
  );
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type ProductTemplate = {
  category: string;
  names: string[];
  descriptions: string[];
  minPrice: number;
  maxPrice: number;
  minStock: number;
  maxStock: number;
  imageUrls: string[];
};

const templates: ProductTemplate[] = [
  {
    category: 'Fashion',
    names: [
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
    descriptions: [
      'A versatile wardrobe essential designed for everyday comfort.',
      'A contemporary style suitable for casual outings and daily wear.',
      'A comfortable design with a practical, easy-to-style fit.',
    ],
    minPrice: 249,
    maxPrice: 3499,
    minStock: 5,
    maxStock: 80,
    imageUrls: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    category: 'Bags',
    names: [
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
    descriptions: [
      'A practical carry essential with a clean, versatile design.',
      'Designed to help keep daily belongings organized and accessible.',
      'A useful accessory for commuting, travel, and everyday errands.',
    ],
    minPrice: 199,
    maxPrice: 4999,
    minStock: 5,
    maxStock: 60,
    imageUrls: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    category: 'Stationery',
    names: [
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
    descriptions: [
      'A useful addition to a student, office, or creative workspace.',
      'Designed to support note-taking, planning, and everyday organization.',
      'A practical stationery essential for school, work, or personal projects.',
    ],
    minPrice: 39,
    maxPrice: 999,
    minStock: 10,
    maxStock: 150,
    imageUrls: [
      'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    category: 'Home Decor',
    names: [
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
    descriptions: [
      'A decorative accent for a comfortable, personalized living space.',
      'A versatile home accessory designed to complement different interiors.',
      'A simple way to refresh a bedroom, living room, or workspace.',
    ],
    minPrice: 149,
    maxPrice: 5999,
    minStock: 3,
    maxStock: 50,
    imageUrls: [
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    category: 'Electronics Accessories',
    names: [
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
    descriptions: [
      'A convenient accessory for a home office or everyday tech setup.',
      'Designed to help keep devices and workspaces practical and organized.',
      'A useful companion for work, study, travel, or daily device use.',
    ],
    minPrice: 99,
    maxPrice: 4999,
    minStock: 5,
    maxStock: 100,
    imageUrls: [
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    category: 'Fitness',
    names: [
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
    descriptions: [
      'A practical fitness accessory for home workouts or gym sessions.',
      'Designed to support an active routine and everyday training needs.',
      'A useful addition to a personal exercise and movement kit.',
    ],
    minPrice: 129,
    maxPrice: 2999,
    minStock: 5,
    maxStock: 70,
    imageUrls: [
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    category: 'Beauty Accessories',
    names: [
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
    descriptions: [
      'An everyday personal-care accessory designed for convenient storage.',
      'A practical organizer for getting ready at home or while travelling.',
      'A useful addition to a beauty, grooming, or travel routine.',
    ],
    minPrice: 79,
    maxPrice: 2499,
    minStock: 5,
    maxStock: 80,
    imageUrls: [
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    category: 'Kitchen',
    names: [
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
    descriptions: [
      'A practical kitchen essential for everyday meals and drinks.',
      'Designed to bring convenience and organization to daily routines.',
      'A versatile addition to a home kitchen or lunch setup.',
    ],
    minPrice: 99,
    maxPrice: 1999,
    minStock: 5,
    maxStock: 100,
    imageUrls: [
      'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1493857671505-72967e2e2760?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    category: 'Outdoor and Travel',
    names: [
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
    descriptions: [
      'A convenient accessory for trips, commutes, and weekend outings.',
      'Designed to help make packing and travelling more organized.',
      'A useful travel companion for everyday journeys and holidays.',
    ],
    minPrice: 99,
    maxPrice: 2999,
    minStock: 5,
    maxStock: 60,
    imageUrls: [
      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85',
    ],
  },
  {
    category: 'Gifts and Lifestyle',
    names: [
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
    descriptions: [
      'A thoughtful lifestyle item for gifting or personal use.',
      'A simple accessory suited to celebrations and everyday enjoyment.',
      'A versatile item for gifting, collecting, or decorating a space.',
    ],
    minPrice: 79,
    maxPrice: 2499,
    minStock: 5,
    maxStock: 80,
    imageUrls: [
      'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=900&q=85',
    ],
  },
];

function deterministicNumber(seed: number, min: number, max: number): number {
  // A deterministic integer generator keeps the same product data on reruns.
  const value = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
  return Math.floor(value * (max - min + 1)) + min;
}

function makeProduct(index: number) {
  const templateIndex = (index - 1) % templates.length;
  const template = templates[templateIndex];

  const nameIndex = Math.floor((index - 1) / templates.length) % template.names.length;
  const descriptionIndex = Math.floor((index - 1) / 7) % template.descriptions.length;
  const imageIndex = nameIndex % template.imageUrls.length;

  const price = deterministicNumber(
    index * 17,
    template.minPrice,
    template.maxPrice,
  );

  const stock = deterministicNumber(
    index * 29,
    template.minStock,
    template.maxStock,
  );

  const productNumber = String(index).padStart(4, '0');
  const productName = template.names[nameIndex];

  return {
    name: `${SEED_PREFIX}${productNumber}] ${productName}`,
    description:
      `${template.descriptions[descriptionIndex]} ` +
      `Category: ${template.category}. ` +
      `Demo catalogue item ${productNumber}, intended for marketplace testing.`,
    price,
    stock,
    imageUrl: template.imageUrls[imageIndex],
    active: true,
  };
}

async function main(): Promise<void> {
  console.log('MarketHub demo product seeding started.');
  console.log(`Target: ${PRODUCT_COUNT} demo products.`);

  // Prefer an explicit vendor ID when supplied. Otherwise, require one
  // unambiguous vendor with the configured demo store name.
  let vendor;

  if (DEMO_VENDOR_ID) {
    vendor = await prisma.vendor.findUnique({
      where: { id: DEMO_VENDOR_ID },
      select: { id: true, storeName: true },
    });

    if (!vendor) {
      throw new Error(
        `No vendor found with DEMO_VENDOR_ID=${DEMO_VENDOR_ID}. ` +
          'Check the ID and try again.',
      );
    }
  } else {
    const vendors = await prisma.vendor.findMany({
      where: { storeName: DEMO_VENDOR_STORE },
      select: { id: true, storeName: true },
      take: 2,
    });

    if (vendors.length !== 1) {
      const allVendors = await prisma.vendor.findMany({
        select: { id: true, storeName: true },
        orderBy: { storeName: 'asc' },
      });

      console.error(
        `Expected exactly one vendor named "${DEMO_VENDOR_STORE}", ` +
          `but found ${vendors.length}.`,
      );
      console.error('Available vendors:');

      for (const item of allVendors) {
        console.error(`- ${item.storeName} | ID: ${item.id}`);
      }

      throw new Error(
        'Set DEMO_VENDOR_ID to the intended existing vendor ID and rerun.',
      );
    }

    vendor = vendors[0];
  }

  console.log(`Target vendor: ${vendor.storeName}`);
  console.log(`Vendor ID: ${vendor.id}`);

  // Fetch only products that use this script's identifying prefix.
  // Existing hand-created products are never updated or deleted.
  const existingSeedProducts = await prisma.product.findMany({
    where: {
      vendorId: vendor.id,
      name: { startsWith: SEED_PREFIX },
    },
    select: { name: true },
  });

  const existingNames = new Set(existingSeedProducts.map((p) => p.name));

  const productsToCreate = [];

  for (let index = 1; index <= PRODUCT_COUNT; index++) {
    const product = makeProduct(index);

    if (!existingNames.has(product.name)) {
      productsToCreate.push({
        ...product,
        vendorId: vendor.id,
      });
    }
  }

  if (productsToCreate.length === 0) {
    console.log(
      `All ${PRODUCT_COUNT} demo products already exist for this vendor. Nothing to add.`,
    );
  } else {
    // createMany is efficient for a 1,000-product batch.
    // No existing product records are updated.
    const result = await prisma.product.createMany({
      data: productsToCreate,
    });

    console.log(`New demo products inserted: ${result.count}`);
  }

  const finalCount = await prisma.product.count({
    where: {
      vendorId: vendor.id,
      name: { startsWith: SEED_PREFIX },
    },
  });

  const allVendorProducts = await prisma.product.count({
    where: { vendorId: vendor.id },
  });

  console.log('');
  console.log('========== SEED SUMMARY ==========');
  console.log(`Vendor: ${vendor.storeName}`);
  console.log(`Target demo products: ${PRODUCT_COUNT}`);
  console.log(`Demo products found after seeding: ${finalCount}`);
  console.log(`All products belonging to vendor: ${allVendorProducts}`);

  if (finalCount !== PRODUCT_COUNT) {
    console.warn(
      `Expected ${PRODUCT_COUNT} demo products, but found ${finalCount}. ` +
        'Check for concurrent seed runs or manual changes.',
    );
  } else {
    console.log('SUCCESS: The full demo catalogue is present.');
  }

  console.log('==================================');
}

main()
  .catch((error: unknown) => {
    console.error('MarketHub product seeding failed.');

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
