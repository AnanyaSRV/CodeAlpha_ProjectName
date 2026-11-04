
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from .env");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const products = [
  { code: "0010", name: "Gift Box Set", image: "0010_gift_box_set.jpg" },
  { code: "0020", name: "Scented Candle Jar", image: "0020_scented_candle_jar.jpg" },
  { code: "0030", name: "Greeting Card Set", image: "0030_greeting_card_set.jpg" },
  { code: "0040", name: "Decorative Keychain", image: "0040_decorative_keychain.jpg" },
  { code: "0050", name: "Photo Album", image: "0050_photo_album.jpg" },
  { code: "0060", name: "Reusable Gift Wrap", image: "0060_reusable_gift_wrap.jpg" },
  { code: "0070", name: "Desk Accessory Set", image: "0070_desk_accessory_set.jpg" },
  { code: "0080", name: "Miniature Display Piece", image: "0080_miniature_display_piece.jpg" },
  { code: "0090", name: "Personal Journal", image: "0090_personal_journal.jpg" },
  { code: "0100", name: "Gift Bag Collection", image: "0100_gift_bag_collection.jpg" },
];

async function main() {
  const imageDirectory = resolve(
    process.cwd(),
    "../frontend/public/images/gifts"
  );

  // Verify all files exist before changing the database.
  for (const item of products) {
    if (!existsSync(resolve(imageDirectory, item.image))) {
      throw new Error(`Missing image: ${item.image}. No changes made.`);
    }
  }

  const matched = [];

  // Verify every demo product before updating any image.
  for (const item of products) {
    const found = await prisma.product.findMany({
      where: {
        name: { startsWith: `[MH-DEMO-${item.code}]` },
        category: "Gifts and Lifestyle",
      },
      select: { id: true, name: true, category: true },
    });

    if (
      found.length !== 1 ||
      !found[0].name.includes(item.name)
    ) {
      throw new Error(
        `Expected exactly one matching Gifts and Lifestyle product for ${item.code} (${item.name}); found ${found.length}. No changes made.`
      );
    }

    matched.push({ item, product: found[0] });
  }

  await prisma.$transaction(
    matched.map(({ item, product }) =>
      prisma.product.update({
        where: { id: product.id },
        data: {
          imageUrl: `/images/gifts/${item.image}`,
        },
      })
    ),
    { maxWait: 10000, timeout: 60000 }
  );

  console.log(`SUCCESS: Updated ${matched.length} Gifts and Lifestyle images.`);

  for (const { item } of matched) {
    console.log(
      `[MH-DEMO-${item.code}] ${item.name} -> /images/gifts/${item.image}`
    );
  }
}

main()
  .catch((error) => {
    console.error("Gifts image update failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
