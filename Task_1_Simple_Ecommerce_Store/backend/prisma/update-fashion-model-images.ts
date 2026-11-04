
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import fs from "node:fs";
import path from "node:path";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from the backend .env file.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const frontend = path.resolve(process.cwd(), "..", "frontend");

const products = [
  {
    suffix: "Summer Dress",
    image: "/images/fashion/08_summer_dress.png",
  },
  {
    suffix: "Lightweight Jacket",
    image: "/images/fashion/09_lightweight_jacket.png",
  },
  {
    suffix: "Linen Top",
    image: "/images/fashion/10_linen_coord_set.png",
    newSuffix: "Linen Coord Set",
  },
];

async function main() {
  const updates: {
    id: string;
    oldName: string;
    newName: string;
    imageUrl: string;
  }[] = [];

  for (const item of products) {
    const imagePath = path.join(frontend, "public", item.image.slice(1));

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    const matches = await prisma.product.findMany({
      where: {
  name: { endsWith: item.suffix },
  category: "Fashion",
},
    });

    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one Fashion product ending in "${item.suffix}", found ${matches.length}. No updates made.`,
      );
    }

    const product = matches[0];
    const newName = item.newSuffix
      ? product.name.slice(0, -item.suffix.length) + item.newSuffix
      : product.name;

    updates.push({
      id: product.id,
      oldName: product.name,
      newName,
      imageUrl: item.image,
    });
  }

  await prisma.$transaction(
    async (tx) => {
      for (const item of updates) {
        await tx.product.update({
          where: { id: item.id },
          data: {
            name: item.newName,
            imageUrl: item.imageUrl,
          },
        });
      }
    },
    { maxWait: 10000, timeout: 60000 },
  );

  console.log("FASHION MODEL IMAGES UPDATED");

  for (const item of updates) {
    console.log(`${item.oldName} -> ${item.newName}`);
    console.log(`  ${item.imageUrl}`);
  }
}

main()
  .catch((error) => {
    console.error("Update failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
