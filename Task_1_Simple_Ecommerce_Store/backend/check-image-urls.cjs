
const fs = require("fs");

const mapPath = "./prisma/demo-product-image-map.json";
const map = JSON.parse(
  fs.readFileSync(mapPath, "utf8").replace(/^\uFEFF/, "")
);

async function main() {
  const entries = Object.entries(map);
  let failed = 0;

  for (const [name, value] of entries) {
    const url = typeof value === "string" ? value : value?.imageUrl;

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(15000),
        headers: { Range: "bytes=0-0" },
      });

      const contentType = response.headers.get("content-type") || "";
      const valid = response.ok && contentType.startsWith("image/");

      if (!valid) failed++;

      console.log(
        `${valid ? "OK" : "CHECK"} | ${name} | ${response.status} | ${contentType}`
      );

      await response.body?.cancel();
    } catch (error) {
      failed++;
      console.log(`FAILED | ${name} | ${error.message}`);
    }
  }

  console.log(`\nChecked: ${entries.length}`);
  console.log(`Failed or not recognized as images: ${failed}`);
}

main().catch(console.error);
