
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing. Check backend/.env.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const updates = [
  {
    name: "Everyday Canvas Tote",
    category: "Bags",
  },
  {
    name: "Handmade Notebook",
    category: "Stationery",
  },
];

async function main() {
  for (const item of updates) {
    const matches = await prisma.product.findMany({
      where: {
        name: item.name,
        category: "Uncategorized",
        active: true,
      },
      select: { id: true, name: true, category: true },
    });

    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one active Uncategorized product named "${item.name}", found ${matches.length}.`,
      );
    }
  }

  for (const item of updates) {
    await prisma.product.updateMany({
      where: {
        name: item.name,
        category: "Uncategorized",
        active: true,
      },
      data: { category: item.category },
    });

    console.log(`Updated: ${item.name} → ${item.category}`);
  }

  const remaining = await prisma.product.count({
    where: { category: "Uncategorized", active: true },
  });

  console.log(`\nRemaining active Uncategorized products: ${remaining}`);
  if (remaining === 0) {
    console.log("SUCCESS: All active products are categorized.");
  }
}

main()
  .catch((error) => {
    console.error("FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
