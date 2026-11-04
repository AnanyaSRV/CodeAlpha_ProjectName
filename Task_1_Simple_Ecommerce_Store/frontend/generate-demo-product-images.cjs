const fs = require("node:fs");
const path = require("node:path");

const root = path.join(process.cwd(), "public", "images", "products");

const products = [
["0002","bags","Canvas Tote Bag","👜"],["0003","stationery","Hardcover Notebook","📓"],["0004","home","Decorative Table Lamp","💡"],["0005","electronics","USB-C Charging Cable","🔌"],["0006","fitness","Yoga Mat","🧘"],["0007","beauty","Makeup Organizer","💄"],["0008","kitchen","Ceramic Coffee Mug","☕"],["0009","travel","Compact Travel Umbrella","☂"],["0010","gifts","Gift Box Set","🎁"],
["0012","bags","Everyday Backpack","🎒"],["0013","stationery","Daily Planner","📔"],["0014","home","Ceramic Flower Vase","🏺"],["0015","electronics","Wireless Mouse","🖱"],["0016","fitness","Resistance Band Set","🏋"],["0017","beauty","Cosmetic Travel Pouch","👜"],["0018","kitchen","Reusable Lunch Box","🍱"],["0019","travel","Packing Cube Set","🧳"],["0020","gifts","Scented Candle Jar","🕯"],
["0022","bags","Laptop Messenger Bag","💼"],["0023","stationery","Sketchbook","🎨"],["0024","home","Cushion Cover Set","🛋"],["0025","electronics","Laptop Stand","💻"],["0026","fitness","Training Water Bottle","🧴"],["0027","beauty","Hair Brush","🪮"],["0028","kitchen","Glass Water Bottle","🍶"],["0029","travel","Travel Neck Pillow","✈"],["0030","gifts","Greeting Card Set","💌"],
["0032","bags","Travel Duffel Bag","🧳"],["0033","stationery","Gel Pen Set","🖊"],["0034","home","Wall Art Print","🖼"],["0035","electronics","Phone Holder","📱"],["0036","fitness","Workout Gloves","🥊"],["0037","beauty","Makeup Brush Set","🖌"],["0038","kitchen","Food Storage Container","🥣"],["0039","travel","Reusable Shopping Tote","🛍"],["0040","gifts","Decorative Gift Set","🎀"],
["0041","fashion","Summer Dress","👗"],["0042","bags","Compact Sling Bag","👜"],["0043","stationery","Sticky Notes Set","🗒"],["0044","home","Decorative Cushion","🛋"],["0045","electronics","Desk Headphone Stand","🎧"],["0046","fitness","Fitness Jump Rope","🏃"],["0047","beauty","Compact Vanity Mirror","🪞"],["0048","kitchen","Insulated Travel Mug","🥤"],["0049","travel","Travel Organizer","🧳"],["0050","gifts","Photo Album","📷"],
["0052","bags","Crossbody Bag","👜"],["0053","stationery","Marker Set","🖍"],["0054","home","Ceramic Planter","🪴"],["0055","electronics","Cable Organizer Kit","🔌"],["0056","fitness","Gym Duffel Bag","🏋"],["0057","beauty","Skincare Organizer","🧴"],["0058","kitchen","Measuring Spoon Set","🥄"],["0059","travel","Outdoor Picnic Mat","🏕"],["0060","gifts","Reusable Gift Wrap","🎁"],
["0061","fashion","Lightweight Jacket","🧥"],["0062","bags","Weekend Travel Bag","🧳"],["0063","stationery","Journal and Pen Kit","📓"],["0064","home","Soft Throw Blanket","🧶"],["0065","electronics","Protective Phone Case","📱"],["0066","fitness","Exercise Towel","🏃"],["0067","beauty","Beauty Accessory Kit","💄"],["0068","kitchen","Kitchen Utensil Set","🍴"],["0069","travel","Insulated Travel Bottle","🧴"],["0070","gifts","Desk Accessory Set","🎁"],
["0072","stationery","Pencil Case","✏"],["0073","stationery","Mechanical Pencil Set","✏"],["0074","home","Storage Basket","🧺"],["0075","electronics","Charging Adapter","🔌"],["0076","fitness","Foam Roller","🏋"],["0077","beauty","Toiletry Organizer","🧴"],["0078","kitchen","Spice Storage Rack","🧂"],["0079","travel","Foldable Daypack","🎒"],["0080","gifts","Miniature Display Piece","🎁"],
["0082","bags","Reusable Shopping Bag","🛍"],["0083","stationery","Document Folder","📁"],["0084","home","Decorative Wall Shelf","🪵"],["0085","electronics","Phone Accessory Kit","📱"],["0086","fitness","Running Belt","🏃"],["0087","beauty","Headband Set","🎀"],["0088","kitchen","Reusable Food Container","🥡"],["0089","travel","Luggage Tag Set","🏷"],["0090","gifts","Personal Journal","📔"],
["0091","fashion","Linen Top","👚"],["0092","bags","Organizer Pouch","👝"],["0093","stationery","Study Flashcards","🗂"],["0094","home","Decorative Candle Holder","🕯"],["0095","electronics","Portable Desk Light","💡"],["0096","fitness","Stretching Strap","🧘"],["0097","beauty","Cosmetic Storage Case","💄"],["0098","kitchen","Measuring Cup Set","🥛"],["0099","travel","Travel Document Wallet","🛂"],["0100","gifts","Gift Bag Collection","🎁"]
];

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

for (const [number, category, name, symbol] of products) {
  const folder = path.join(root, category);
  fs.mkdirSync(folder, { recursive: true });

  const title = escapeXml(name);
  const safeSymbol = escapeXml(symbol);
  const hue = (Number(number) * 37) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue},55%,96%)"/><stop offset="1" stop-color="hsl(${(hue+35)%360},50%,88%)"/></linearGradient></defs><rect width="800" height="800" rx="36" fill="url(#bg)"/><circle cx="400" cy="330" r="190" fill="#ffffff" fill-opacity=".72"/><text x="400" y="390" text-anchor="middle" font-size="190" font-family="Arial,sans-serif">${safeSymbol}</text><text x="400" y="625" text-anchor="middle" font-size="35" font-weight="700" fill="#253247" font-family="Arial,sans-serif">${title}</text><text x="400" y="680" text-anchor="middle" font-size="20" letter-spacing="4" fill="#536176" font-family="Arial,sans-serif">MARKETHUB • DEMO</text></svg>`;

  fs.writeFileSync(path.join(folder, `${number}.svg`), svg, "utf8");
}

console.log(`Created ${products.length} product illustrations.`);
console.log(`Saved under: ${root}`);
console.log("Database was not changed.");
