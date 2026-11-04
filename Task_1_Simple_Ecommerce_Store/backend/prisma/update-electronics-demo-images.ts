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
  { code: "0005", name: "USB-C Charging Cable", image: "0005_usb_c_charging_cable.jpg" },
  { code: "0015", name: "Wireless Mouse", image: "0015_wireless_mouse.jpg" },
  { code: "0025", name: "Laptop Stand", image: "0025_laptop_stand.jpg" },
  { code: "0035", name: "Phone Holder", image: "0035_phone_holder.jpg" },
  { code: "0045", name: "Desk Headphone Stand", image: "0045_desk_headphone_stand.jpg" },
  { code: "0055", name: "Cable Organizer Kit", image: "0055_cable_organizer_kit.jpg" },
  { code: "0065", name: "Protective Phone Case", image: "0065_protective_phone_case.jpg" },
  { code: "0075", name: "Compact USB Hub", image: "0075_compact_usb_hub.jpg" },
  { code: "0085", name: "Laptop Sleeve", image: "0085_laptop_sleeve.jpg" },
  { code: "0095", name: "Portable Desk Light", image: "0095_portable_desk_light.jpg" },
];

async function main() {
  const imageDirectory = resolve(process.cwd(), "../frontend/public/images/electronics");

  // Validate every image and database match before making any changes.
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
        category: "Electronics Accessories",
      },
      select: { id: true, name: true, category: true },
    });

    if (found.length !== 1 || !found[0].name.includes(item.name)) {
      throw new Error(
        `Expected one Electronics Accessories product [MH-DEMO-${item.code}] ${item.name}; found ${found.length}. No database changes made.`
      );
    }
    matched.push({ item, product: found[0] });
  }

  await prisma.$transaction(
    matched.map(({ item, product }) =>
      prisma.product.update({
        where: { id: product.id },
        data: { imageUrl: `/images/electronics/${item.image}` },
      })
    ),
    { maxWait: 10000, timeout: 60000 }
  );

  console.log(`SUCCESS: Updated ${matched.length} Electronics Accessories demo product images.`);
  for (const { item } of matched) {
    console.log(`[MH-DEMO-${item.code}] ${item.name} -> /images/electronics/${item.image}`);
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
