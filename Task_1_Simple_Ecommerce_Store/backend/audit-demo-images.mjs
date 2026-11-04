import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { PrismaClient } from './src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is missing');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function csv(value) {
  const text = value == null ? '' : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

async function main() {
  const products = await prisma.product.findMany({
    where: { name: { startsWith: '[MH-DEMO-' } },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      active: true,
    },
    orderBy: { name: 'asc' },
  });

  const normalizeUrl = (url) => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return url.trim();
    }
  };

  const getDemoNumber = (name) => {
    const match = name.match(/^\[MH-DEMO-(\d+)\]/);
    return match ? Number(match[1]) : null;
  };

  const getProductType = (name) =>
    name.replace(/^\[MH-DEMO-\d+\]\s*/, '').trim();

  const urlGroups = new Map();

  for (const product of products) {
    const key = normalizeUrl(product.imageUrl);
    if (!key) continue;

    if (!urlGroups.has(key)) urlGroups.set(key, []);
    urlGroups.get(key).push(product);
  }

  const rows = products.map((product) => {
    const key = normalizeUrl(product.imageUrl);
    const sameUrlProducts = key ? urlGroups.get(key) ?? [] : [];
    const differentTypes = [
      ...new Set(sameUrlProducts.map((p) => getProductType(p.name))),
    ];

    let auditStatus = 'HAS_IMAGE_REVIEW_VISUALLY';

    if (!product.imageUrl?.trim()) {
      auditStatus = 'MISSING_IMAGE';
    } else if (differentTypes.length > 1) {
      auditStatus = 'SHARED_BY_DIFFERENT_PRODUCT_TYPES';
    }

    return {
      demoNumber: getDemoNumber(product.name),
      name: product.name,
      id: product.id,
      active: product.active,
      imageUrl: product.imageUrl ?? '',
      auditStatus,
      sharedUrlCount: sameUrlProducts.length,
      productTypesUsingUrl: differentTypes.join(' | '),
    };
  });

  const headers = [
    'demoNumber',
    'name',
    'id',
    'active',
    'imageUrl',
    'auditStatus',
    'sharedUrlCount',
    'productTypesUsingUrl',
  ];

  const csvText = [
    headers.map(csv).join(','),
    ...rows.map((row) => headers.map((key) => csv(row[key])).join(',')),
  ].join('\r\n');

  await writeFile('.\\demo-image-audit.csv', csvText, 'utf8');

  const missing = rows.filter((r) => r.auditStatus === 'MISSING_IMAGE');
  const sharedDifferentTypes = rows.filter(
    (r) => r.auditStatus === 'SHARED_BY_DIFFERENT_PRODUCT_TYPES',
  );

  const duplicateGroups = [...urlGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([url, group]) => ({
      url,
      count: group.length,
      types: [...new Set(group.map((p) => getProductType(p.name)))],
      names: group.map((p) => p.name),
    }))
    .sort((a, b) => b.count - a.count);

  console.log('Total demo products:', products.length);
  console.log('Missing image URLs:', missing.length);
  console.log(
    'Products sharing a URL across different product types:',
    sharedDifferentTypes.length,
  );
  console.log('Repeated URL groups:', duplicateGroups.length);
  console.log('\nMissing images:');
  console.table(missing.map(({ demoNumber, name }) => ({ demoNumber, name })));
  console.log('\nLargest cross-type duplicate groups:');
  console.table(
    duplicateGroups
      .filter((g) => g.types.length > 1)
      .slice(0, 30)
      .map((g) => ({
        count: g.count,
        types: g.types.join(' | '),
        products: g.names.slice(0, 5).join(' | '),
      })),
  );
  console.log('\nFull report saved to backend\\demo-image-audit.csv');
}

main()
  .catch((error) => {
    console.error('Audit failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
