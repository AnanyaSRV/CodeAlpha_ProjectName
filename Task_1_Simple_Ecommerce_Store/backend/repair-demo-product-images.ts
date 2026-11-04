
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client.ts";
import fs from "node:fs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL missing.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const PREFIX = "[MH-DEMO-";
const cache = JSON.parse(
  fs.readFileSync("./prisma/unsplash-image-cache.json", "utf8")
) as Record<string, { imageUrl?: string; description?: string }>;

const knownGood: Record<string, string> = {
  "Cotton T-Shirt": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=85",
  "Casual Shirt": "https://images.unsplash.com/photo-1602810320073-1230c46d89d4?auto=format&fit=crop&w=800&q=85",
  "Classic Denim Jeans": "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=800&q=85",
  "Canvas Tote Bag": "https://images.unsplash.com/photo-1574365569389-a10d488ca3fb?auto=format&fit=crop&w=800&q=85",
  "Everyday Backpack": "https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&w=800&q=85",
  "Travel Duffel Bag": "https://images.unsplash.com/photo-1525103504173-8dc1582c7430?auto=format&fit=crop&w=800&q=85",
  "Hardcover Notebook": "https://images.unsplash.com/photo-1647559709298-c0e3dcb47092?auto=format&fit=crop&w=800&q=85",
  "Daily Planner": "https://images.unsplash.com/photo-1531346852511-e39bf96dc721?auto=format&fit=crop&w=800&q=85",
  "Decorative Table Lamp": "https://images.unsplash.com/photo-1771363340681-6d059f408235?auto=format&fit=crop&w=800&q=85",
  "Ceramic Flower Vase": "https://images.unsplash.com/photo-1588874133473-d6d9c9dd4f31?auto=format&fit=crop&w=800&q=85",
  "Wireless Mouse": "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=85",
  "Yoga Mat": "https://images.unsplash.com/photo-1599447292180-45fd84092ef4?auto=format&fit=crop&w=800&q=85",
  "Makeup Organizer": "https://images.unsplash.com/photo-1608979048467-6194dabc6a3d?auto=format&fit=crop&w=800&q=85",
  "Ceramic Coffee Mug": "https://images.unsplash.com/photo-1605714196241-00bf7a8fe7bb?auto=format&fit=crop&w=800&q=85",
  "USB-C Charging Cable": "https://images.unsplash.com/photo-1572721546624-05bf65ad7679?auto=format&fit=crop&w=800&q=85",
};

function cleanName(name: string) {
  return name.replace(/^\[MH-DEMO-\d+\]\s*/, "").trim();
}

function stableHash(text: string) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

async function main() {
  const products = await prisma.product.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true, name: true, category: true },
    orderBy: { name: "asc" },
  });

  if (products.length !== 1000) {
    throw new Error(`Safety stop: expected 1000 demo products; found ${products.length}.`);
  }

  const mapping = new Map<string, string>();

  for (const p of products) {
    const name = cleanName(p.name);
    const key = `${p.category}::${name}`;
    if (mapping.has(key)) continue;

    const cached = cache[key]?.imageUrl;
    const imageUrl =
      knownGood[name] ||
      (cached && ![
        "Fitness::Yoga Mat",
        "Beauty Accessories::Hair Brush",
        "Outdoor and Travel::Packing Cube Set",
        "Outdoor and Travel::Travel Neck Pillow",
        "Outdoor and Travel::Reusable Shopping Tote",
        "Gifts and Lifestyle::Gift Box Set",
      ].includes(key) ? cached : undefined) ||
      `https://images.unsplash.com/photo-${[
        "1529139574466-a303027c1d8b",
        "1515886657613-9f3515b0c78f",
        "1490481651871-ab68de25d43d",
        "1523275335684-37898b6baf30",
        "1503602642458-232111445657",
        "1526170375885-4d8ecf77b99f",
        "1542291026-7eec264c27ff",
        "1543163521-1a8ee7a8f0c5",
        "1521572163474-6864f9cf17ab",
        "1548036328-c9fa89d128fa",
        "1553062407-98eeb64c6a62",
        "1544816155-12df9643f363",
        "1494438639946-1ebd1d20bf85",
        "1507473885765-e6ed057f782c",
        "1519710164239-da123dc03ef4",
        "1523275335684-37898b6baf30",
      ][stableHash(key) % 16]}?auto=format&fit=crop&w=800&q=85`;

    mapping.set(key, imageUrl);
  }

  console.log("Products:", products.length);
  console.log("Distinct product mappings:", mapping.size);
  console.log("Preview:");
  for (const [key, url] of [...mapping.entries()].slice(0, 15)) {
    console.log(`${key} -> ${url}`);
  }

  const apply = process.argv.includes("--apply");
  if (!apply) {
    console.log("\nPREVIEW ONLY. Run with --apply to update imageUrl fields.");
    return;
  }

      for (let i = 0; i < products.length; i += 25) {
    const batch = products.slice(i, i + 25);

    await Promise.all(
      batch.map((p) => {
        const key = `${p.category}::${cleanName(p.name)}`;
        const imageUrl = mapping.get(key);

        if (!imageUrl) {
          throw new Error(`Missing image mapping for ${key}`);
        }

        return prisma.product.update({
          where: { id: p.id },
          data: { imageUrl },
        });
      })
    );

    console.log(`Updated ${Math.min(i + batch.length, products.length)} / ${products.length}`);
  }
  console.log(`Updated imageUrl for ${products.length} demo products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());