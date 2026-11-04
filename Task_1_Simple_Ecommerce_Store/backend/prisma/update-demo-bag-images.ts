
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import fs from "node:fs";
import path from "node:path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL missing");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const frontend = path.resolve(process.cwd(), "..", "frontend");

const updates = [
  { number: "0002", suffix: "Canvas Tote Bag", image: "01_canvas_tote_bag.jpg" },
  { number: "0012", suffix: "Everyday Backpack", image: "02_everyday_backpack.jpg" },
  { number: "0022", suffix: "Laptop Messenger Bag", image: "03_laptop_messenger_bag.jpg" },
  { number: "0032", suffix: "Travel Duffel Bag", image: "04_travel_duffel_bag.jpg" },
  { number: "0042", suffix: "Compact Sling Bag", image: "05_compact_sling_bag.jpg" },
  { number: "0052", suffix: "Crossbody Bag", image: "06_crossbody_bag.jpg" },
  { number: "0062", suffix: "Weekend Travel Bag", image: "04_travel_duffel_bag.jpg" },
  { number: "0082", suffix: "Reusable Shopping Bag", image: "01_canvas_tote_bag.jpg", newSuffix: "Tote Bag" },
  { number: "0092", suffix: "Organizer Pouch", image: "07_organizer_pouch.jpg" },
];

async function main() {
  const prepared = [];

  for (const item of updates) {
    const productName = `[MH-DEMO-${item.number}] ${item.suffix}`;
    const matches = await prisma.product.findMany({
  where: { name: productName },
  take: 2,
});

if (matches.length !== 1) {
  throw new Error(
    `Expected exactly one product named "${productName}", found ${matches.length}.`,
  );
}

const product = matches[0];

    if (!product) throw new Error(`Product not found: ${productName}`);
    if (product.category !== "Bags") {
      throw new Error(`Unexpected category for ${productName}: ${product.category}`);
    }

    const imageUrl = `/images/bags/${item.image}`;
    const imagePath = path.join(frontend, "public", imageUrl.slice(1));

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file missing: ${imagePath}`);
    }

    prepared.push({
      id: product.id,
      oldName: product.name,
      newName: item.newSuffix
        ? `[MH-DEMO-${item.number}] ${item.newSuffix}`
        : product.name,
      imageUrl,
    });
  }

  const tote = prepared.find((p) => p.oldName.includes("Reusable Shopping Bag"));
  if (tote) {
    const collisions = await prisma.product.findMany({
  where: { name: tote.newName },
  take: 2,
});

const collision = collisions.find((p) => p.id !== tote.id);

if (collision) {
  throw new Error(`A product already exists with the name ${tote.newName}`);
}
    if (collision && collision.id !== tote.id) {
      throw new Error(`A product already exists with the name ${tote.newName}`);
    }
  }

  await prisma.$transaction(
    async (tx) => {
      for (const item of prepared) {
        await tx.product.update({
          where: { id: item.id },
          data: { name: item.newName, imageUrl: item.imageUrl },
        });
      }
    },
    { maxWait: 10000, timeout: 60000 },
  );

  console.log("BAG IMAGE UPDATE COMPLETE");
  console.table(
    prepared.map(({ oldName, newName, imageUrl }) => ({
      oldName,
      newName,
      imageUrl,
    })),
  );
}

main()
  .catch((error) => {
    console.error("Update failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
