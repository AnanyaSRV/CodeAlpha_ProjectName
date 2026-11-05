
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const vendorId = process.env.DEMO_VENDOR_ID;
const databaseUrl = process.env.DATABASE_URL;

if (!vendorId || !databaseUrl) {
  throw new Error('Missing DEMO_VENDOR_ID or DATABASE_URL in backend/.env');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const imageRoot = resolve(process.cwd(), '../frontend/public/images');

const mappings: Record<string, string> = {
  'Cotton T-Shirt': 'fashion/01_cotton_t_shirt.png',
  'Casual Shirt': 'fashion/02_casual_shirt.png',
  'Everyday Hoodie': 'fashion/03_everyday_hoodie.png',
  'Classic Denim Jeans': 'fashion/04_classic_denim_jeans.png',
  'Relaxed Fit Trousers': 'fashion/05_relaxed_fit_trousers.png',
  'Knit Sweater': 'fashion/06_knit_sweater.png',
  'Casual Kurta': 'fashion/07_casual_kurta.png',
  'Summer Dress': 'fashion/08_summer_dress.png',
  'Lightweight Jacket': 'fashion/09_lightweight_jacket.png',
  'Linen Coord Set': 'fashion/10_linen_coord_set.png',
  'Linen Top': 'fashion/10_linen_coord_set.png',
  'Classic Cotton T-Shirt': 'fashion/11_classic_cotton_tshirt.jpg',

  'Canvas Tote Bag': 'bags/01_canvas_tote_bag.jpg',
  'Reusable Shopping Bag': 'bags/01_canvas_tote_bag.jpg',
  'Everyday Backpack': 'bags/02_everyday_backpack.jpg',
  'Laptop Messenger Bag': 'bags/03_laptop_messenger_bag.jpg',
  'Travel Duffel Bag': 'bags/04_travel_duffel_bag.jpg',
  'Compact Sling Bag': 'bags/05_compact_sling_bag.jpg',
  'Crossbody Bag': 'bags/06_crossbody_bag.jpg',
  'Organizer Pouch': 'bags/07_organizer_pouch.jpg',
  'Weekend Travel Bag': 'bags/07_weekend_travel_bag.jpg',
  'Minimalist Wallet': 'bags/08_minimalist_wallet.jpg',

  'Hardcover Notebook': 'stationery/0003_hardcover_notebook.jpg',
  'Daily Planner': 'stationery/0013_daily_planner.jpg',
  'Sketchbook': 'stationery/0023_sketchbook.jpg',
  'Gel Pen Set': 'stationery/0033_gel_pen_set.jpg',
  'Desk Organizer': 'stationery/0043_desk_organizer.jpg',
  'Sticky Note Set': 'stationery/0053_sticky_note_set.jpg',
  'Journal and Pen Kit': 'stationery/0063_journal_and_pen_kit.jpg',
  'Mechanical Pencil Set': 'stationery/0073_mechanical_pencil_set.jpg',
  'Document Folder': 'stationery/0083_document_folder.jpg',
  'Study Flashcards': 'stationery/0093_study_flashcards.jpg',

  'Decorative Table Lamp': 'home-decor/0004_decorative_table_lamp.jpg',
  'Ceramic Flower Vase': 'home-decor/0014_ceramic_flower_vase.jpg',
  'Cushion Cover Set': 'home-decor/0024_cushion_cover_set.jpg',
  'Wall Art Print': 'home-decor/0034_wall_art_print.jpg',
  'Decorative Planter': 'home-decor/0044_decorative_planter.jpg',
  'Minimalist Wall Clock': 'home-decor/0054_minimalist_wall_clock.jpg',
  'Soft Throw Blanket': 'home-decor/0064_soft_throw_blanket.jpg',
  'Storage Basket': 'home-decor/0074_storage_basket.jpg',
  'Photo Frame': 'home-decor/0084_photo_frame.jpg',
  'Decorative Candle Holder': 'home-decor/0094_decorative_candle_holder.jpg',

  'USB-C Charging Cable': 'electronics/0005_usb_c_charging_cable.jpg',
  'Wireless Mouse': 'electronics/0015_wireless_mouse.jpg',
  'Laptop Stand': 'electronics/0025_laptop_stand.jpg',
  'Phone Holder': 'electronics/0035_phone_holder.jpg',
  'Desk Headphone Stand': 'electronics/0045_desk_headphone_stand.jpg',
  'Cable Organizer Kit': 'electronics/0055_cable_organizer_kit.jpg',
  'Protective Phone Case': 'electronics/0065_protective_phone_case.jpg',
  'Compact USB Hub': 'electronics/0075_compact_usb_hub.jpg',
  'Laptop Sleeve': 'electronics/0085_laptop_sleeve.jpg',
  'Portable Desk Light': 'electronics/0095_portable_desk_light.jpg',

  'Yoga Mat': 'fitness/0006_yoga_mat.jpg',
  'Resistance Band Set': 'fitness/0016_resistance_band_set.jpg',
  'Training Water Bottle': 'fitness/0026_training_water_bottle.jpg',
  'Workout Gloves': 'fitness/0036_workout_gloves.jpg',
  'Jump Rope': 'fitness/0046_jump_rope.jpg',
  'Gym Duffel Bag': 'fitness/0056_gym_duffel_bag.jpg',
  'Exercise Towel': 'fitness/0066_exercise_towel.jpg',
  'Foam Roller': 'fitness/0076_foam_roller.jpg',
  'Running Belt': 'fitness/0086_running_belt.jpg',
  'Stretching Strap': 'fitness/0096_stretching_strap.jpg',

  'Makeup Organizer': 'beauty/0007_makeup_organizer.jpg',
  'Cosmetic Travel Pouch': 'beauty/0017_cosmetic_travel_pouch.jpg',
  'Hair Brush': 'beauty/0027_hair_brush.jpg',
  'Makeup Brush Set': 'beauty/0037_makeup_brush_set.jpg',
  'Compact Vanity Mirror': 'beauty/0047_compact_vanity_mirror.jpg',
  'Hair Clip Set': 'beauty/0057_hair_clip_set.jpg',
  'Reusable Makeup Pads': 'beauty/0067_reusable_makeup_pads.jpg',
  'Toiletry Organizer': 'beauty/0077_toiletry_organizer.jpg',
  'Headband Set': 'beauty/0087_headband_set.jpg',
  'Cosmetic Storage Case': 'beauty/0097_cosmetic_storage_case.jpg',

  'Ceramic Coffee Mug': 'kitchen/0008_ceramic_coffee_mug.jpg',
  'Reusable Lunch Box': 'kitchen/0018_reusable_lunch_box.jpg',
  'Glass Water Bottle': 'kitchen/0028_glass_water_bottle.jpg',
  'Kitchen Storage Jar Set': 'kitchen/0038_kitchen_storage_jar_set.jpg',
  'Insulated Travel Mug': 'kitchen/0048_insulated_travel_mug.jpg',
  'Cotton Kitchen Towel Set': 'kitchen/0058_cotton_kitchen_towel_set.jpg',
  'Serving Tray': 'kitchen/0068_serving_tray.jpg',
  'Spice Storage Rack': 'kitchen/0078_spice_storage_rack.jpg',
  'Reusable Food Container': 'kitchen/0088_reusable_food_container.jpg',
  'Measuring Cup Set': 'kitchen/0098_measuring_cup_set.jpg',

  'Compact Travel Umbrella': 'travel/0009_compact_travel_umbrella.jpg',
  'Packing Cube Set': 'travel/0019_packing_cube_set.jpg',
  'Travel Neck Pillow': 'travel/0029_travel_neck_pillow.jpg',
  'Reusable Shopping Tote': 'travel/0039_reusable_shopping_tote.jpg',
  'Travel Toiletry Bag': 'travel/0049_travel_toiletry_bag.jpg',
  'Outdoor Picnic Mat': 'travel/0059_outdoor_picnic_mat.jpg',
  'Insulated Travel Bottle': 'travel/0069_insulated_travel_bottle.jpg',
  'Foldable Daypack': 'travel/0079_foldable_daypack.jpg',
  'Luggage Tag Set': 'travel/0089_luggage_tag_set.jpg',

  'Gift Box Set': 'gifts/0010_gift_box_set.jpg',
  'Scented Candle Jar': 'gifts/0020_scented_candle_jar.jpg',
  'Greeting Card Set': 'gifts/0030_greeting_card_set.jpg',
  'Decorative Keychain': 'gifts/0040_decorative_keychain.jpg',
  'Photo Album': 'gifts/0050_photo_album.jpg',
  'Reusable Gift Wrap': 'gifts/0060_reusable_gift_wrap.jpg',
  'Desk Accessory Set': 'gifts/0070_desk_accessory_set.jpg',
  'Miniature Display Piece': 'gifts/0080_miniature_display_piece.jpg',
  'Personal Journal': 'gifts/0090_personal_journal.jpg',
  'Gift Bag Collection': 'gifts/0100_gift_bag_collection.jpg',
};

async function main() {
  const products = await prisma.product.findMany({
    where: {
      vendorId,
      name: { startsWith: '[MH-DEMO-' },
    },
    select: {
      id: true,
      name: true,
      imageUrl: true,
    },
    orderBy: { name: 'asc' },
  });

  const unmatched = new Set<string>();
  const updates: { id: string; imageUrl: string; name: string }[] = [];
  const missingFiles: string[] = [];

  for (const product of products) {
    const productName = product.name.replace(/^\[MH-DEMO-\d+\]\s*/, '');
    const imagePath = mappings[productName];

    if (!imagePath) {
      unmatched.add(productName);
      continue;
    }

    if (!existsSync(resolve(imageRoot, imagePath))) {
      missingFiles.push(`${productName}: ${imagePath}`);
      continue;
    }

    updates.push({
      id: product.id,
      imageUrl: `/images/${imagePath}`,
      name: product.name,
    });
  }

  console.log('\n========== IMAGE MAPPING REPORT ==========');
  console.log(`Total products: ${products.length}`);
  console.log(`Matched products: ${updates.length}`);
  console.log(`Unmatched product records: ${products.length - updates.length}`);
  console.log(`Unique unmatched product names: ${unmatched.size}`);

  console.log('\n========== UNMATCHED PRODUCT NAMES ==========');
  for (const name of [...unmatched].sort()) {
    console.log(`- ${name}`);
  }

  if (missingFiles.length > 0) {
    console.log('\n========== MISSING IMAGE FILES ==========');
    for (const item of missingFiles) {
      console.log(`- ${item}`);
    }
  }

  console.log('\n========== SAMPLE MATCHES ==========');
  for (const item of updates.slice(0, 10)) {
    console.log(`${item.name} -> ${item.imageUrl}`);
  }

  if (process.argv.includes('--apply')) {
    console.log('\nApplying image updates...');

    for (const update of updates) {
      await prisma.product.update({
        where: { id: update.id },
        data: { imageUrl: update.imageUrl },
      });
    }

    console.log(`SUCCESS: Updated ${updates.length} product image URLs.`);
  } else {
    console.log('\nPREVIEW ONLY. No database records were changed.');
  }
}

main()
  .catch((error) => {
    console.error('Image mapping failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
