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
  const totalProducts = await prisma.product.count();
  const activeProducts = await prisma.product.count({
    where: { active: true },
  });

  const vendorCounts = await prisma.product.groupBy({
    by: ["vendorId"],
    _count: { _all: true },
  });

  const vendors = await prisma.vendor.findMany({
    select: {
      id: true,
      storeName: true,
      userId: true,
    },
  });

  const vendorMap = new Map(
    vendors.map((vendor) => [vendor.id, vendor]),
  );

  console.log("\n===== PRODUCT TOTALS =====");
  console.log("All products:", totalProducts);
  console.log("Active products:", activeProducts);

  console.log("\n===== PRODUCTS PER VENDOR =====");

  for (const item of vendorCounts) {
    const vendor = vendorMap.get(item.vendorId);

    console.log({
      storeName: vendor?.storeName ?? "Unknown vendor",
      vendorId: item.vendorId,
      userId: vendor?.userId ?? "Unknown user",
      productCount: item._count._all,
    });
  }

  console.log("\n===== HAIR CLIP SEARCH =====");

  const matches = await prisma.product.findMany({
    where: {
      name: { contains: "Hair Clip", mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      active: true,
      imageUrl: true,
      vendor: {
        select: {
          storeName: true,
        },
      },
    },
  });

  console.log("Matching products:", matches.length);
  console.dir(matches, { depth: null });
}

main()
  .catch((error) => {
    console.error("Diagnostic failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
