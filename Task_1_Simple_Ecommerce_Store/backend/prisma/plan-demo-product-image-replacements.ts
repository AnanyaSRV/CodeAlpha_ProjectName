import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const fashionPaths = new Set([
  "/images/fashion/01_cotton_t_shirt.png",
  "/images/fashion/02_casual_shirt.png",
  "/images/fashion/03_everyday_hoodie.png",
  "/images/fashion/04_classic_denim_jeans.png",
  "/images/fashion/05_relaxed_fit_trousers.png",
  "/images/fashion/06_knit_sweater.png",
  "/images/fashion/07_casual_kurta.png",
]);

const replacements = {
  "0002": "/images/products/bags/canvas-tote-bag.png",
  "0003": "/images/products/stationery/hardcover-notebook.png",
  "0004": "/images/products/home/decorative-table-lamp.png",
  "0005": "/images/products/electronics/usb-c-charging-cable.png",
  "0006": "/images/products/fitness/yoga-mat.png",
  "0007": "/images/products/beauty/makeup-organizer.png",
  "0008": "/images/products/kitchen/ceramic-coffee-mug.png",
  "0009": "/images/products/travel/compact-travel-umbrella.png",
  "0010": "/images/products/gifts/gift-box-set.png",
  "0012": "/images/products/bags/everyday-backpack.png",
  "0013": "/images/products/stationery/daily-planner.png",
  "0014": "/images/products/home/ceramic-flower-vase.png",
  "0015": "/images/products/electronics/wireless-mouse.png",
  "0016": "/images/products/fitness/resistance-band-set.png",
  "0017": "/images/products/beauty/cosmetic-travel-pouch.png",
  "0018": "/images/products/kitchen/reusable-lunch-box.png",
  "0019": "/images/products/travel/packing-cube-set.png",
  "0020": "/images/products/gifts/scented-candle-jar.png",
  "0022": "/images/products/bags/laptop-messenger-bag.png",
  "0023": "/images/products/stationery/sketchbook.png",
  "0024": "/images/products/home/cushion-cover-set.png",
  "0025": "/images/products/electronics/laptop-stand.png",
  "0026": "/images/products/fitness/training-water-bottle.png",
  "0027": "/images/products/beauty/hair-brush.png",
  "0028": "/images/products/kitchen/glass-water-bottle.png",
  "0029": "/images/products/travel/travel-neck-pillow.png",
  "0030": "/images/products/gifts/greeting-card-set.png",
  "0032": "/images/products/bags/travel-duffel-bag.png",
  "0033": "/images/products/stationery/gel-pen-set.png",
  "0034": "/images/products/home/wall-art-print.png",
  "0035": "/images/products/electronics/phone-holder.png",
  "0036": "/images/products/fitness/workout-gloves.png",
  "0037": "/images/products/beauty/makeup-brush-set.png",
  "0038": "/images/products/kitchen/food-storage-container.png",
  "0039": "/images/products/travel/reusable-shopping-tote.png",
  "0040": "/images/products/gifts/decorative-gift-set.png",
  "0041": "/images/products/fashion/summer-dress.png",
  "0042": "/images/products/bags/compact-sling-bag.png",
  "0043": "/images/products/stationery/sticky-notes-set.png",
  "0044": "/images/products/home/decorative-cushion.png",
  "0045": "/images/products/electronics/desk-headphone-stand.png",
  "0046": "/images/products/fitness/fitness-jump-rope.png",
  "0047": "/images/products/beauty/compact-vanity-mirror.png",
  "0048": "/images/products/kitchen/insulated-travel-mug.png",
  "0049": "/images/products/travel/travel-organizer.png",
  "0050": "/images/products/gifts/photo-album.png",
  "0052": "/images/products/bags/crossbody-bag.png",
  "0053": "/images/products/stationery/marker-set.png",
  "0054": "/images/products/home/ceramic-planter.png",
  "0055": "/images/products/electronics/cable-organizer-kit.png",
  "0056": "/images/products/fitness/gym-duffel-bag.png",
  "0057": "/images/products/beauty/skincare-organizer.png",
  "0058": "/images/products/kitchen/measuring-spoon-set.png",
  "0059": "/images/products/travel/outdoor-picnic-mat.png",
  "0060": "/images/products/gifts/reusable-gift-wrap.png",
  "0061": "/images/products/fashion/lightweight-jacket.png",
  "0062": "/images/products/bags/weekend-travel-bag.png",
  "0063": "/images/products/stationery/journal-and-pen-kit.png",
  "0064": "/images/products/home/soft-throw-blanket.png",
  "0065": "/images/products/electronics/protective-phone-case.png",
  "0066": "/images/products/fitness/exercise-towel.png",
  "0067": "/images/products/beauty/beauty-accessory-kit.png",
  "0068": "/images/products/kitchen/kitchen-utensil-set.png",
  "0069": "/images/products/travel/insulated-travel-bottle.png",
  "0070": "/images/products/gifts/desk-accessory-set.png",
  "0072": "/images/products/stationery/pencil-case.png",
  "0073": "/images/products/stationery/mechanical-pencil-set.png",
  "0074": "/images/products/home/storage-basket.png",
  "0075": "/images/products/electronics/charging-adapter.png",
  "0076": "/images/products/fitness/foam-roller.png",
  "0077": "/images/products/beauty/toiletry-organizer.png",
  "0078": "/images/products/kitchen/spice-storage-rack.png",
  "0079": "/images/products/travel/foldable-daypack.png",
  "0080": "/images/products/gifts/miniature-display-piece.png",
  "0082": "/images/products/bags/reusable-shopping-bag.png",
  "0083": "/images/products/stationery/document-folder.png",
  "0084": "/images/products/home/decorative-wall-shelf.png",
  "0085": "/images/products/electronics/phone-accessory-kit.png",
  "0086": "/images/products/fitness/running-belt.png",
  "0087": "/images/products/beauty/headband-set.png",
  "0088": "/images/products/kitchen/reusable-food-container.png",
  "0089": "/images/products/travel/luggage-tag-set.png",
  "0090": "/images/products/gifts/personal-journal.png",
  "0091": "/images/products/fashion/linen-top.png",
  "0092": "/images/products/bags/organizer-pouch.png",
  "0093": "/images/products/stationery/study-flashcards.png",
  "0094": "/images/products/home/decorative-candle-holder.png",
  "0095": "/images/products/electronics/portable-desk-light.png",
  "0096": "/images/products/fitness/stretching-strap.png",
  "0097": "/images/products/beauty/cosmetic-storage-case.png",
  "0098": "/images/products/kitchen/measuring-cup-set.png",
  "0099": "/images/products/travel/travel-document-wallet.png",
  "0100": "/images/products/gifts/gift-bag-collection.png",
};

try {
  const products = await prisma.product.findMany({
    where: { name: { startsWith: "[MH-DEMO-" } },
    select: { id: true, name: true, imageUrl: true },
    orderBy: { name: "asc" },
  });

  if (products.length !== 100) {
    throw new Error(`Expected 100 demo products, found ${products.length}.`);
  }

  const planned = [];
  const missing = [];

  for (const p of products) {
    const match = p.name.match(/^\[MH-DEMO-(\d{4})\]/);
    if (!match) {
      missing.push(p.name);
      continue;
    }

    const number = match[1];
    if (number === "0001" || number === "0011" || number === "0021" ||
        number === "0031" || number === "0051" || number === "0071" ||
        number === "0081") {
      if (!fashionPaths.has(p.imageUrl)) {
        throw new Error(`Fashion image mismatch: ${p.name} => ${p.imageUrl}`);
      }
      continue;
    }

    const newUrl = replacements[number];
    if (!newUrl) {
      missing.push(p.name);
      continue;
    }

    planned.push({
      id: p.id,
      name: p.name,
      oldImageUrl: p.imageUrl,
      newImageUrl: newUrl,
    });
  }

  if (missing.length) {
    throw new Error(`Missing product mappings:\n${missing.join("\n")}`);
  }

  const outputPath = path.join("prisma", "demo-product-image-replacement-plan.json");
  fs.writeFileSync(outputPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    note: "Plan only. These destination files must exist before applying changes.",
    changes: planned,
  }, null, 2), "utf8");

  console.log(`Products checked: ${products.length}`);
  console.log(`Fashion images preserved: 7`);
  console.log(`Other image mappings planned: ${planned.length}`);
  console.log(`Plan saved: ${outputPath}`);
  console.log("No database changes were made.");
  console.log("WARNING: destination image files must be created before applying this plan.");
} finally {
  await prisma.$disconnect();
}
