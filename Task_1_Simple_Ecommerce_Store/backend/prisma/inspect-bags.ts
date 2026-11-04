import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL missing");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const products = await prisma.product.findMany({
    where: { name: { startsWith: "[MH-DEMO-" } },
    select: { name: true, category: true, imageUrl: true },
    orderBy: { name: "asc" },
  });

  console.table(products);
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());