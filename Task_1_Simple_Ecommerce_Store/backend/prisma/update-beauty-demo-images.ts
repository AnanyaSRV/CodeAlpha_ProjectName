import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from the environment.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const products = [
  { code: "0007", name: "Makeup Organizer", image: "0007_makeup_organizer.jpg" },
  { code: "0017", name: "Cosmetic Travel Pouch", image: "0017_cosmetic_travel_pouch.jpg" },
  { code: "0027", name: "Hair Brush", image: "0027_hair_brush.jpg" },
  { code: "0037", name: "Makeup Brush Set", image: "0037_makeup_brush_set.jpg" },
  { code: "0047", name: "Compact Vanity Mirror", image: "0047_compact_vanity_mirror.jpg" },
  { code: "0057", name: "Hair Clip Set", image: "0057_hair_clip_set.jpg" },
  { code: "0067", name: "Reusable Makeup Pads", image: "0067_reusable_makeup_pads.jpg" },
  { code: "0077", name: "Toiletry Organizer", image: "0077_toiletry_organizer.jpg" },
  { code: "0087", name: "Headband Set", image: "0087_headband_set.jpg" },
  { code: "0097", name: "Cosmetic Storage Case", image: "0097_cosmetic_storage_case.jpg" },
];

async function main() {
  const imageDirectory = resolve(process.cwd(), "../frontend/public/images/beauty");

  for (const item of products) {
    if (!existsSync(resolve(imageDirectory, item.image))) {
      throw new Error(`Missing image file: ${item.image}. No database changes made.`);
    }
  }

  const matched = [];
  for (const item of products) {
    const found = await prisma.product.findMany({
      where: {
        name: { startsWith: `[MH-DEMO-${item.code}]` },
        category: "Beauty Accessories",
      },
      select: { id: true, name: true, category: true, imageUrl: true },
    });

    if (found.length !== 1 || !found[0].name.includes(item.name)) {
      throw new Error(
        `Expected exactly one Beauty Accessories product [MH-DEMO-${item.code}] ${item.name}; found ${found.length}. No database changes made.`
      );
    }
    matched.push({ item, product: found[0] });
  }

  await prisma.$transaction(
    matched.map(({ item, product }) =>
      prisma.product.update({
        where: { id: product.id },
        data: { imageUrl: `/images/beauty/${item.image}` },
      })
    ),
    { maxWait: 10000, timeout: 60000 }
  );

  console.log(`SUCCESS: Updated ${matched.length} Beauty Accessories demo product images.`);
  for (const { item } of matched) {
    console.log(`[MH-DEMO-${item.code}] ${item.name} -> /images/beauty/${item.image}`);
  }
}

main()
  .catch((error) => {
    console.error("Image update failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
