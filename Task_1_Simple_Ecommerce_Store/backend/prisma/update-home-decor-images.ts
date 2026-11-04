
import { access } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from backend/.env");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const imageDirectory = path.resolve(
  process.cwd(),
  "../frontend/public/images/decor"
);

const products = [
  {
    id: "0004",
    name: "Decorative Table Lamp",
    image: "0004_decorative_table_lamp.jpg",
  },
  {
    id: "0014",
    name: "Ceramic Flower Vase",
    image: "0014_ceramic_flower_vase.jpg",
  },
  {
    id: "0024",
    name: "Cushion Cover Set",
    image: "0024_cushion_cover_set.jpg",
  },
  {
    id: "0034",
    name: "Wall Art Print",
    image: "0034_wall_art_print.jpg",
  },
  {
    id: "0044",
    name: "Decorative Planter",
    image: "0044_decorative_planter.jpg",
  },
  {
    id: "0054",
    name: "Minimalist Wall Clock",
    image: "0054_minimalist_wall_clock.jpg",
  },
  {
    id: "0064",
    name: "Soft Throw Blanket",
    image: "0064_soft_throw_blanket.jpg",
  },
  {
    id: "0074",
    name: "Storage Basket",
    image: "0074_storage_basket.jpg",
  },
  {
    id: "0084",
    name: "Photo Frame",
    image: "0084_photo_frame.jpg",
  },
  {
    id: "0094",
    name: "Decorative Candle Holder",
    image: "0094_decorative_candle_holder.jpg",
  },
];

async function main() {
  // Validate all image files before changing the database.
  for (const product of products) {
    await access(path.join(imageDirectory, product.image));
  }

  console.log("All 10 image files are present. Updating products...\n");

  let updated = 0;

  for (const product of products) {
    const expectedName = `[MH-DEMO-${product.id}] ${product.name}`;

    const matches = await prisma.product.findMany({
      where: {
        name: expectedName,
        category: "Home Decor",
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one Home Decor product named "${expectedName}", found ${matches.length}. No update was made for this product.`
      );
    }

    await prisma.product.update({
      where: { id: matches[0].id },
      data: {
        imageUrl: `/images/home-decor/${product.image}`,
      },
    });

    updated++;
    console.log(`Updated: ${expectedName}`);
    console.log(`Image:   /images/home-decor/${product.image}\n`);
  }

  console.log(`SUCCESS: Updated ${updated} Home Decor product images.`);
}

main()
  .catch((error) => {
    console.error("Home Decor image update failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
