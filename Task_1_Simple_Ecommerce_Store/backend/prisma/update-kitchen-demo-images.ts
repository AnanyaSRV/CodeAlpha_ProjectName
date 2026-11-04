import { access } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing. Check backend/.env.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const imageDirectory = path.resolve(
  process.cwd(),
  "../frontend/public/images/kitchen",
);

const products = [
  { id: "0008", name: "Ceramic Coffee Mug", file: "0008_ceramic_coffee_mug.jpg" },
  { id: "0018", name: "Reusable Lunch Box", file: "0018_reusable_lunch_box.jpg" },
  { id: "0028", name: "Glass Water Bottle", file: "0028_glass_water_bottle.jpg" },
  { id: "0038", name: "Kitchen Storage Jar Set", file: "0038_kitchen_storage_jar_set.jpg" },
  { id: "0048", name: "Insulated Travel Mug", file: "0048_insulated_travel_mug.jpg" },
  { id: "0058", name: "Cotton Kitchen Towel Set", file: "0058_cotton_kitchen_towel_set.jpg" },
  { id: "0068", name: "Serving Tray", file: "0068_serving_tray.jpg" },
  { id: "0078", name: "Spice Storage Rack", file: "0078_spice_storage_rack.jpg" },
  { id: "0088", name: "Reusable Food Container", file: "0088_reusable_food_container.jpg" },
  { id: "0098", name: "Measuring Cup Set", file: "0098_measuring_cup_set.jpg" },
];

async function main() {
  for (const product of products) {
    await access(path.join(imageDirectory, product.file));
  }

  for (const product of products) {
    const expectedName = `[MH-DEMO-${product.id}] ${product.name}`;
    const matches = await prisma.product.findMany({
      where: { name: expectedName, category: "Kitchen" },
      select: { id: true, name: true },
    });

    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one Kitchen product named "${expectedName}", found ${matches.length}.`,
      );
    }

    const imageUrl = `/images/kitchen/${product.file}`;

    await prisma.product.update({
      where: { id: matches[0].id },
      data: { imageUrl },
    });

    console.log(`Updated: ${expectedName}\nImage:   ${imageUrl}\n`);
  }

  console.log("SUCCESS: Updated all 10 Kitchen product images.");
}

main()
  .catch((error) => {
    console.error("FAILED to update Kitchen product images:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
