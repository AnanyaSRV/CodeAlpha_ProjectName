import { readFile } from 'node:fs/promises';

const path = './prisma/unsplash-image-cache.json';

try {
  const cache = JSON.parse(await readFile(path, 'utf8'));
  const entries = Object.entries(cache).filter(
    ([key]) => key !== '__MARKETHUB_IMAGE_CACHE_META__'
  );

  const rows = entries.map(([key, value]) => ({
    productType: key.split('::').slice(1).join('::'),
    category: key.split('::')[0],
    status: value === null ? 'NO MATCH' : 'CACHED IMAGE',
    description: value?.description ?? '',
    imageUrl: value?.imageUrl ?? '',
    photoId: value?.photoId ?? '',
  }));

  const byUrl = new Map();

  for (const row of rows) {
    if (!row.imageUrl) continue;
    if (!byUrl.has(row.imageUrl)) byUrl.set(row.imageUrl, []);
    byUrl.get(row.imageUrl).push(row.productType);
  }

  console.log('Cache entries:', rows.length);
  console.log('Entries with images:', rows.filter(r => r.imageUrl).length);
  console.log('Entries without matches:', rows.filter(r => !r.imageUrl).length);
  console.log(
    'Image URLs reused by multiple product types:',
    [...byUrl.values()].filter(types => new Set(types).size > 1).length
  );

  console.log('\nCached image descriptions:');
  console.table(rows.map(({ category, productType, status, description }) => ({
    category, productType, status, description
  })));

  const report = rows.map(row =>
    Object.values(row).map(value =>
      '"' + String(value).replace(/"/g, '""') + '"'
    ).join(',')
  );

  await (await import('node:fs/promises')).writeFile(
    './prisma/unsplash-image-cache-audit.csv',
    [
      '"productType","category","status","description","imageUrl","photoId"',
      ...report,
    ].join('\r\n'),
    'utf8'
  );

  console.log('\nFull report: prisma\\unsplash-image-cache-audit.csv');
} catch (error) {
  console.error('Cache audit failed:', error.message);
  process.exitCode = 1;
}
