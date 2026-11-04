import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL missing");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const matches = await prisma.product.findMany({
    where: { name: "[MH-DEMO-0062] Weekend Travel Bag" },
    take: 2,
  });

  if (matches.length !== 1) {
    throw new Error(`Expected one Weekend Travel Bag, found ${matches.length}`);
  }

  const product = matches[0];

  if (product.category !== "Bags") {
    throw new Error(`Unexpected category: ${product.category}`);
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { imageUrl: "/images/bags/07_weekend_travel_bag.jpg" },
  });

  console.log("Weekend Travel Bag image updated successfully.");
}

main()
  .catch((error) => {
    console.error("Update failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());