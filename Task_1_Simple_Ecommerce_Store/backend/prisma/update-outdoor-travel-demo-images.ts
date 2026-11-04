import { access } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const imageDirectory = path.resolve(process.cwd(), "../frontend/public/images/travel");
const products = [
  { id: "0009", name: "Compact Travel Umbrella", file: "0009_compact_travel_umbrella.jpg" },
  { id: "0019", name: "Packing Cube Set", file: "0019_packing_cube_set.jpg" },
  { id: "0029", name: "Travel Neck Pillow", file: "0029_travel_neck_pillow.jpg" },
  { id: "0039", name: "Reusable Shopping Tote", file: "0039_reusable_shopping_tote.jpg" },
  { id: "0049", name: "Travel Toiletry Bag", file: "0049_travel_toiletry_bag.jpg" },
  { id: "0059", name: "Outdoor Picnic Mat", file: "0059_outdoor_picnic_mat.jpg" },
  { id: "0069", name: "Insulated Travel Bottle", file: "0069_insulated_travel_bottle.jpg" },
  { id: "0079", name: "Foldable Daypack", file: "0079_foldable_daypack.jpg" },
  { id: "0089", name: "Luggage Tag Set", file: "0089_luggage_tag_set.jpg" },
];

async function main() {
  for (const product of products) await access(path.join(imageDirectory, product.file));
  const results = await prisma.$transaction(async (tx) => {
    const updated = [];
    for (const product of products) {
      const name = `[MH-DEMO-${product.id}] ${product.name}`;
      const matches = await tx.product.findMany({ where: { name, category: "Outdoor and Travel" }, select: { id: true, name: true } });
      if (matches.length !== 1) throw new Error(`Expected exactly one product for ${name}; found ${matches.length}.`);
      const result = await tx.product.update({
        where: { id: matches[0].id },
        data: { imageUrl: `/images/travel/${product.file}` },
        select: { name: true, imageUrl: true },
      });
      updated.push(result);
    }
    const removeName = "[MH-DEMO-0099] Travel Document Wallet";
    const removeMatches = await tx.product.findMany({ where: { name: removeName, category: "Outdoor and Travel" }, select: { id: true } });
    if (removeMatches.length > 1) throw new Error(`Found multiple products named ${removeName}.`);
    if (removeMatches.length === 1) {
      await tx.product.update({ where: { id: removeMatches[0].id }, data: { active: false } });
    }
    return { updated, deactivated: removeMatches.length === 1 };
  }, { maxWait: 10000, timeout: 60000 });
  for (const item of results.updated) console.log(`Updated: ${item.name}\nImage:   ${item.imageUrl}\n`);
  console.log(`SUCCESS: Updated ${results.updated.length} Outdoor and Travel images.`);
  console.log(results.deactivated ? "Travel Document Wallet is now inactive." : "Travel Document Wallet was not found; no product was deactivated.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
