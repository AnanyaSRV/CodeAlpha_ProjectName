
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from the environment.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const products = [
  { code: "0006", name: "Yoga Mat", image: "0006_yoga_mat.jpg" },
  { code: "0016", name: "Resistance Band Set", image: "0016_resistance_band_set.jpg" },
  { code: "0026", name: "Training Water Bottle", image: "0026_training_water_bottle.jpg" },
  { code: "0036", name: "Workout Gloves", image: "0036_workout_gloves.jpg" },
  { code: "0046", name: "Jump Rope", image: "0046_jump_rope.jpg" },
  { code: "0056", name: "Gym Duffel Bag", image: "0056_gym_duffel_bag.jpg" },
  { code: "0066", name: "Exercise Towel", image: "0066_exercise_towel.jpg" },
  { code: "0076", name: "Foam Roller", image: "0076_foam_roller.jpg" },
  { code: "0086", name: "Running Belt", image: "0086_running_belt.jpg" },
  { code: "0096", name: "Stretching Strap", image: "0096_stretching_strap.jpg" },
];

async function main() {
  const imageDirectory = resolve(
    process.cwd(),
    "../frontend/public/images/fitness"
  );

  // Validate every image before making any database changes.
  for (const item of products) {
    if (!existsSync(resolve(imageDirectory, item.image))) {
      throw new Error(
        `Missing image: ${item.image}. No database changes made.`
      );
    }
  }

  const matched = [];

  // Validate all product IDs, names, and categories first.
  for (const item of products) {
    const found = await prisma.product.findMany({
      where: {
        name: { startsWith: `[MH-DEMO-${item.code}]` },
        category: "Fitness",
      },
      select: {
        id: true,
        name: true,
        category: true,
      },
    });

    if (
      found.length !== 1 ||
      !found[0].name.includes(item.name)
    ) {
      throw new Error(
        `Expected one Fitness product [MH-DEMO-${item.code}] ${item.name}; found ${found.length}. No database changes made.`
      );
    }

    matched.push({ item, product: found[0] });
  }

  await prisma.$transaction(
    matched.map(({ item, product }) =>
      prisma.product.update({
        where: { id: product.id },
        data: {
          imageUrl: `/images/fitness/${item.image}`,
        },
      })
    ),
    { maxWait: 10000, timeout: 60000 }
  );

  console.log(
    `SUCCESS: Updated ${matched.length} Fitness product images.`
  );

  for (const { item } of matched) {
    console.log(
      `[MH-DEMO-${item.code}] ${item.name} -> /images/fitness/${item.image}`
    );
  }
}

main()
  .catch((error) => {
    console.error("Fitness image update failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
