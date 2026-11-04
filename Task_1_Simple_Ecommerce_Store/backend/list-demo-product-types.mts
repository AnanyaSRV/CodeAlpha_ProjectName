import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

try {
  const products = await prisma.product.findMany({
    where: { name: { startsWith: "[MH-DEMO-" } },
    select: { name: true, category: true },
    orderBy: { name: "asc" },
  });

  const unique = new Map<string, string>();
  for (const p of products) {
    const name = p.name.replace(/^\[MH-DEMO-\d+\]\s*/, "").trim();
    unique.set(`${p.category}::${name}`, `${p.category} | ${name}`);
  }

  console.log([...unique.values()].join("\n"));
} finally {
  await prisma.$disconnect();
}
