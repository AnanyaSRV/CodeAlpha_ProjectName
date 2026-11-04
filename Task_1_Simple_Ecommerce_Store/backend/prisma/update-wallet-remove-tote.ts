
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
  const walletName = "[MH-DEMO-0072] Minimalist Wallet";
  const toteName = "[MH-DEMO-0082] Tote Bag";

  const wallet = await prisma.product.findMany({
    where: { name: walletName, category: "Bags" },
  });

  const tote = await prisma.product.findMany({
    where: { name: toteName, category: "Bags" },
  });

  if (wallet.length !== 1 || tote.length !== 1) {
    throw new Error(
      `Validation failed. Wallet matches: ${wallet.length}; Tote Bag matches: ${tote.length}. No changes made.`
    );
  }

  const imagePath = "../frontend/public/images/bags/08_minimalist_wallet.jpg";

  const { existsSync } = await import("node:fs");

  if (!existsSync(imagePath)) {
    throw new Error(
      "Wallet image not found. Check frontend/public/images/bags/08_minimalist_wallet.jpg"
    );
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.product.update({
        where: { id: wallet[0].id },
        data: {
          imageUrl: "/images/bags/08_minimalist_wallet.jpg",
          active: true,
        },
      });

      // Deactivate Tote Bag without permanently deleting its record.
      await tx.product.update({
        where: { id: tote[0].id },
        data: { active: false },
      });
    },
    { maxWait: 10000, timeout: 60000 }
  );

  console.log("SUCCESS: Minimalist Wallet image updated.");
  console.log("SUCCESS: [MH-DEMO-0082] Tote Bag deactivated.");
  console.log("Canvas Tote Bag [MH-DEMO-0002] remains unchanged.");
}

main()
  .catch((error) => {
    console.error("Update failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
