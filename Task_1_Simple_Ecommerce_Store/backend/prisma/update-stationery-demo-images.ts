import { access } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing. Check backend/.env.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const imageDirectory = path.resolve(
  process.cwd(),
  "../frontend/public/images/stationery",
);

const products = [
  { id: "0003", name: "Hardcover Notebook", file: "0003_hardcover_notebook.jpg" },
  { id: "0013", name: "Daily Planner", file: "0013_daily_planner.jpg" },
  { id: "0023", name: "Sketchbook", file: "0023_sketchbook.jpg" },
  { id: "0033", name: "Gel Pen Set", file: "0033_gel_pen_set.jpg" },
  { id: "0043", name: "Desk Organizer", file: "0043_desk_organizer.jpg" },
  { id: "0053", name: "Sticky Note Set", file: "0053_sticky_note_set.jpg" },
  { id: "0063", name: "Journal and Pen Kit", file: "0063_journal_and_pen_kit.jpg" },
  { id: "0073", name: "Mechanical Pencil Set", file: "0073_mechanical_pencil_set.jpg" },
  { id: "0083", name: "Document Folder", file: "0083_document_folder.jpg" },
  { id: "0093", name: "Study Flashcards", file: "0093_study_flashcards.jpg" },
];

async function main() {
  for (const product of products) {
    await access(path.join(imageDirectory, product.file));
  }

  for (const product of products) {
    const expectedName = `[MH-DEMO-${product.id}] ${product.name}`;
    const matches = await prisma.product.findMany({
      where: { name: expectedName, category: "Stationery" },
      select: { id: true, name: true },
    });

    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one Stationery product named "${expectedName}", found ${matches.length}. No update was applied for this product.`,
      );
    }
  }

  for (const product of products) {
    const expectedName = `[MH-DEMO-${product.id}] ${product.name}`;
    const imageUrl = `/images/stationery/${product.file}`;

    await prisma.product.updateMany({
      where: { name: expectedName, category: "Stationery" },
      data: { imageUrl },
    });

    console.log(`Updated: ${expectedName}`);
    console.log(`Image:   ${imageUrl}\n`);
  }

  console.log("SUCCESS: Updated 10 Stationery product images.");
}

main()
  .catch((error) => {
    console.error("FAILED to update Stationery product images:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
