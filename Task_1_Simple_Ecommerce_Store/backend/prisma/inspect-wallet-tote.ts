
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from the environment.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: "wallet", mode: "insensitive" } },
        { name: { contains: "tote", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      category: true,
      imageUrl: true,
      active: true,
    },
    orderBy: { name: "asc" },
  });

  console.table(products);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
