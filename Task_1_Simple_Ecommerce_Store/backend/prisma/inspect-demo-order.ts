import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from backend .env");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const prefixes = [
    "[MH-DEMO-0001]",
    "[MH-DEMO-0019]",
    "[MH-DEMO-0029]",
    "[MH-DEMO-0033]",
    "[MH-DEMO-0049]",
    "[MH-DEMO-0050]",
    "[MH-DEMO-0051]",
    "[MH-DEMO-0101]",
  ];

  console.log("\n========== SELECTED DEMO PRODUCTS ==========");

  for (const prefix of prefixes) {
    const product = await prisma.product.findFirst({
      where: { name: { startsWith: prefix } },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        active: true,
        createdAt: true,
        vendor: {
          select: { storeName: true },
        },
      },
    });

    console.log(`\n${prefix}`);
    console.dir(product, { depth: null });
  }

  console.log("\n========== DEMO PRODUCTS 1–40 ==========");

  const firstForty = await prisma.product.findMany({
    where: { name: { startsWith: "[MH-DEMO-" } },
    orderBy: { name: "asc" },
    take: 40,
    select: {
      name: true,
      imageUrl: true,
      createdAt: true,
    },
  });

  console.table(
    firstForty.map((product) => ({
      name: product.name,
      hasImage: Boolean(product.imageUrl),
      createdAt: product.createdAt.toISOString(),
    }))
  );
}

main()
  .catch((error) => {
    console.error("Diagnostic failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
