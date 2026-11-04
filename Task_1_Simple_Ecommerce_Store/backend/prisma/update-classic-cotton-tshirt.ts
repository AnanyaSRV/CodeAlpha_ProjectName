import path from "node:path";
import { access } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing. Check backend/.env.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const imagePath = path.resolve(
  process.cwd(),
  "../frontend/public/images/fashion/11_classic_cotton_tshirt.jpg",
);

async function main() {
  await access(imagePath);

  const matches = await prisma.product.findMany({
    where: {
      name: { contains: "Classic Cotton T-Shirt", mode: "insensitive" },
      category: { in: ["Uncategorized", "Fashion"] },
    },
    select: { id: true, name: true, category: true, imageUrl: true },
  });

  if (matches.length !== 1) {
    console.log("Products matching Classic Cotton T-Shirt:");
    console.table(matches);
    throw new Error(
      `Expected exactly one matching product in Uncategorized/Fashion, found ${matches.length}. No product was changed.`,
    );
  }

  const product = matches[0];
  await prisma.product.update({
    where: { id: product.id },
    data: {
      category: "Fashion",
      imageUrl: "/images/fashion/11_classic_cotton_tshirt.jpg",
    },
  });

  console.log(`Updated image and category: ${product.name}`);
  console.log("Category: Fashion");
  console.log("Image: /images/fashion/11_classic_cotton_tshirt.jpg");

  const remaining = await prisma.product.findMany({
    where: { category: "Uncategorized", active: true },
    select: { id: true, name: true, description: true, category: true },
    orderBy: { name: "asc" },
  });

  console.log(`\nRemaining active Uncategorized products: ${remaining.length}`);
  if (remaining.length) console.table(remaining);
}

main()
  .catch((error) => {
    console.error("FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
