const fs = require("node:fs");
const path = require("node:path");

const inputPath = path.join(__dirname, "demo-product-cleanup-audit.json");
const outputPath = path.join(__dirname, "demo-product-image-review.csv");

const report = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const products = report.allProducts;

if (!Array.isArray(products) || products.length !== 100) {
  throw new Error(
    `Expected 100 products in the audit report; found ${
      Array.isArray(products) ? products.length : "no product list"
    }. No CSV was created.`
  );
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

const headers = [
  "ID",
  "Name",
  "Category",
  "Image URL",
  "Order Item Count",
];

const rows = products.map((product) =>
  [
    product.id,
    product.name,
    product.category,
    product.imageUrl,
    product.orderItemCount,
  ]
    .map(csvCell)
    .join(",")
);

const csv = [headers.join(","), ...rows].join("\r\n");

fs.writeFileSync(outputPath, "\uFEFF" + csv, "utf8");

console.log(`Export successful: ${products.length} products`);
console.log(`File: ${outputPath}`);