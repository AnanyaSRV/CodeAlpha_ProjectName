
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const DEMO_PREFIX = '[MH-DEMO-';
const MAX_NEW_SEARCHES_PER_RUN = 40;
const CACHE_PATH = join(
  process.cwd(),
  'prisma',
  'unsplash-image-cache.json',
);

const CACHE_META_KEY = '__MARKETHUB_IMAGE_CACHE_META__';

type UnsplashPhoto = {
  id: string;
  alt_description: string | null;
  description: string | null;
  urls: {
    small: string;
  };
  links: {
    html: string;
    download_location: string;
  };
  user: {
    name: string;
    links: {
      html: string;
    };
  };
};

type CachedPhoto = {
  imageUrl: string;
  photoId: string;
  description: string;
  photographerName: string;
  photographerUrl: string;
  photoPageUrl: string;
  downloadLocation: string;
} | null;

type CacheMeta = {
  __marketHubCacheMeta: true;
  hairClipRefreshDone?: boolean;
};

type CacheValue = CachedPhoto | CacheMeta;
type Cache = Record<string, CacheValue>;

type ProductGroup = {
  category: string;
  productType: string;
  ids: string[];
};

const connectionString = process.env.DATABASE_URL;
const accessKey = process.env.UNSPLASH_ACCESS_KEY;

if (!connectionString) {
  throw new Error('DATABASE_URL is missing from backend .env.');
}

if (!accessKey) {
  throw new Error('UNSPLASH_ACCESS_KEY is missing from backend .env.');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'the',
  'for',
  'with',
  'of',
  'in',
  'on',
  'to',
  'by',
  'product',
  'products',
  'photography',
  'photo',
  'set',
  'pack',
  'piece',
  'pieces',
  'everyday',
  'classic',
  'decorative',
  'compact',
  'daily',
  'casual',
  'training',
  'premium',
  'modern',
  'basic',
  'standard',
  'small',
  'large',
  'mini',
  'new',
  'portable',
  'reusable',
  'lightweight',
  'hardcover',
  'wireless',
  'cotton',
  'canvas',
  'denim',
  'leather',
  'ceramic',
  'glass',
  'wooden',
  'metal',
  'plastic',
  'stainless',
  'steel',
  'charging',
  'travel',
  'c',
]);

const SPECIAL_MATCHES: Record<string, RegExp[]> = {
  'hair clip': [
    /\bhair[\s-]*clips?\b/i,
    /\bclaw[\s-]*clips?\b/i,
    /\bbarrettes?\b/i,
    /\bhairpins?\b/i,
    /\bhair[\s-]+accessor(?:y|ies)\b/i,
  ],
  'laptop stand': [
    /\blaptop[\s-]+stands?\b/i,
    /\blaptop[\s-]+risers?\b/i,
    /\bnotebook[\s-]+stands?\b/i,
  ],
  'yoga mat': [
    /\byoga[\s-]+mats?\b/i,
    /\bexercise[\s-]+mats?\b/i,
    /\bfitness[\s-]+mats?\b/i,
  ],
  'gift box': [
    /\bgift[\s-]+boxes?\b/i,
    /\bgift[\s-]+packaging\b/i,
    /\bgift[\s-]+hamper\b/i,
  ],
  'resistance band': [
    /\bresistance[\s-]+bands?\b/i,
    /\bexercise[\s-]+bands?\b/i,
    /\bworkout[\s-]+bands?\b/i,
    /\bfitness[\s-]+bands?\b/i,
  ],
  'packing cube': [
    /\bpacking[\s-]+cubes?\b/i,
    /\btravel[\s-]+organizer[\s-]+cubes?\b/i,
  ],
  'hair brush': [
    /\bhair[\s-]*brush(?:es)?\b/i,
    /\bhairbrush(?:es)?\b/i,
    /\bdetangling[\s-]+brush(?:es)?\b/i,
  ],
  'gel pen': [
    /\bgel[\s-]+pens?\b/i,
  ],
  'makeup brush': [
    /\bmakeup[\s-]+brush(?:es)?\b/i,
    /\bcosmetic[\s-]+brush(?:es)?\b/i,
  ],
  'tote bag': [
    /\btote[\s-]+bags?\b/i,
  ],
  'water bottle': [
    /\bwater[\s-]+bottles?\b/i,
    /\bdrinking[\s-]+bottles?\b/i,
  ],
  'phone holder': [
    /\bphone[\s-]+holders?\b/i,
    /\bmobile[\s-]+phone[\s-]+stands?\b/i,
    /\bphone[\s-]+stands?\b/i,
  ],
};

function isCacheMeta(value: CacheValue | undefined): value is CacheMeta {
  return (
    value !== null &&
    typeof value === 'object' &&
    '__marketHubCacheMeta' in value
  );
}

function getCacheMeta(cache: Cache): CacheMeta {
  const value = cache[CACHE_META_KEY];

  if (isCacheMeta(value)) {
    return value;
  }

  return {
    __marketHubCacheMeta: true,
    hairClipRefreshDone: false,
  };
}

function getCachedPhoto(value: CacheValue | undefined): CachedPhoto {
  if (value === undefined || value === null || isCacheMeta(value)) {
    return null;
  }

  return value;
}

function getProductType(name: string): string {
  return name.replace(/^\[MH-DEMO-\d+\]\s*/, '').trim();
}

function getCategory(description: string | null): string {
  if (!description) {
    return 'General';
  }

  const match = description.match(/Category:\s*([^.]+)/i);
  return match?.[1]?.trim() ?? 'General';
}

function getCacheKey(category: string, productType: string): string {
  return `${category}::${productType}`;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCoreTerms(productType: string): string[] {
  const normalized = normalizeText(productType);

  const terms = normalized
    .split(' ')
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));

  return [...new Set(terms)];
}

function getSpecialMatch(productType: string): RegExp[] {
  const normalized = normalizeText(productType);

  for (const [key, patterns] of Object.entries(SPECIAL_MATCHES)) {
    if (normalized.includes(normalizeText(key))) {
      return patterns;
    }
  }

  return [];
}

function getSearchQuery(category: string, productType: string): string {
  const cleanType = productType
    .replace(/[()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return `"${cleanType}" ${category} product photography`;
}

function isHairClipProduct(productType: string): boolean {
  return /\bhair[\s-]*clips?\b|\bbarrette\b|\bclaw[\s-]*clip\b/i.test(
    productType,
  );
}

function getPhotoText(photo: UnsplashPhoto): string {
  return [
    photo.alt_description ?? '',
    photo.description ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

function hasMatchingProduct(
  photo: UnsplashPhoto,
  productType: string,
): boolean {
  const text = getPhotoText(photo);

  // Product-specific aliases help with items that have several common names.
  const specialPatterns = getSpecialMatch(productType);

  if (specialPatterns.length > 0) {
    return specialPatterns.some((pattern) => pattern.test(text));
  }

  const terms = getCoreTerms(productType);

  if (terms.length === 0) {
    return false;
  }

  // Require every meaningful product term to appear in the photo's
  // descriptive text. This deliberately favors relevance over coverage.
  return terms.every((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}(?:s|es)?\\b`, 'i');

    return pattern.test(text);
  });
}

function attributionUrl(value: string): string {
  const result = new URL(value);
  result.searchParams.set('utm_source', 'MarketHub');
  result.searchParams.set('utm_medium', 'referral');
  return result.toString();
}

async function recordUnsplashDownload(downloadLocation: string): Promise<void> {
  try {
    await fetch(downloadLocation, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        'Accept-Version': 'v1',
      },
    });
  } catch (error) {
    // A tracking failure should not discard an otherwise usable photo.
    console.warn(
      '  Could not record the Unsplash download event:',
      error instanceof Error ? error.message : error,
    );
  }
}

async function searchUnsplash(
  query: string,
  productType: string,
): Promise<CachedPhoto> {
  const url = new URL('https://api.unsplash.com/search/photos');

  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '10');
  url.searchParams.set('content_filter', 'high');

  const response = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      'Accept-Version': 'v1',
    },
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Unsplash returned HTTP ${response.status}. ${body.slice(0, 400)}`,
    );
  }

  const data = (await response.json()) as {
    results: UnsplashPhoto[];
  };

  const candidates = (data.results ?? []).filter(
    (photo) => photo.urls?.small,
  );

  if (candidates.length === 0) {
    console.log('  Unsplash returned no usable photos.');
    return null;
  }

  // Do not automatically use the first result. Accept only a result whose
  // alt text or description explicitly supports the product match.
  const photo = candidates.find((candidate) =>
    hasMatchingProduct(candidate, productType),
  );

  if (!photo) {
    console.log(
      '  No sufficiently relevant photo found. Existing product images will be kept.',
    );

    console.log(
      '  Sample result descriptions:',
      candidates
        .slice(0, 3)
        .map(
          (candidate) =>
            candidate.alt_description ??
            candidate.description ??
            '(no description)',
        )
        .join(' | '),
    );

    return null;
  }

  await recordUnsplashDownload(photo.links.download_location);

  return {
    // Keep the image URL exactly as returned by Unsplash.
    imageUrl: photo.urls.small,
    photoId: photo.id,
    description:
      photo.alt_description ??
      photo.description ??
      'Unsplash product photograph',
    photographerName: photo.user.name,
    photographerUrl: attributionUrl(photo.user.links.html),
    photoPageUrl: attributionUrl(photo.links.html),
    downloadLocation: photo.links.download_location,
  };
}

async function loadCache(): Promise<Cache> {
  try {
    const contents = await readFile(CACHE_PATH, 'utf8');
    return JSON.parse(contents) as Cache;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

async function saveCache(cache: Cache): Promise<void> {
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

async function main(): Promise<void> {
  console.log('Loading MarketHub demo products...');

  const products = await prisma.product.findMany({
    where: {
      name: { startsWith: DEMO_PREFIX },
    },
    select: {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
    },
    orderBy: { name: 'asc' },
  });

  if (products.length === 0) {
    throw new Error(
      `No demo products found with the prefix "${DEMO_PREFIX}". ` +
        'No database changes were made.',
    );
  }

  console.log(`Found ${products.length} demo products.`);

  const cache = await loadCache();
  const meta = getCacheMeta(cache);

  const groups = new Map<string, ProductGroup>();

  for (const product of products) {
    const category = getCategory(product.description);
    const productType = getProductType(product.name);
    const key = getCacheKey(category, productType);

    if (!groups.has(key)) {
      groups.set(key, {
        category,
        productType,
        ids: [],
      });
    }

    groups.get(key)!.ids.push(product.id);
  }

  // One-time refresh of the hair-clip search, because the previous image
  // was unrelated. The marker prevents repeated refreshes on later runs.
  const forcedKeys: string[] = [];

  if (!meta.hairClipRefreshDone) {
    for (const [key, group] of groups) {
      if (isHairClipProduct(group.productType)) {
        delete cache[key];
        forcedKeys.push(key);
      }
    }

    cache[CACHE_META_KEY] = meta;
    await saveCache(cache);
  }

  const missingKeys = [...groups.keys()].filter(
    (key) => !Object.prototype.hasOwnProperty.call(cache, key),
  );

  const keysToSearch = [
    ...new Set([...forcedKeys, ...missingKeys]),
  ].slice(0, MAX_NEW_SEARCHES_PER_RUN);

  console.log(`Unique product types: ${groups.size}`);
  console.log(
    `Already cached: ${
      [...groups.keys()].filter((key) =>
        Object.prototype.hasOwnProperty.call(cache, key),
      ).length
    }`,
  );
  console.log(`New searches this run: ${keysToSearch.length}`);

  let searchesSucceeded = 0;
  let searchesEmpty = 0;
  let searchesFailed = 0;

  // Only these successfully completed searches may update database images.
  const processedKeys = new Set<string>();

  for (const key of keysToSearch) {
    const group = groups.get(key)!;
    const query = getSearchQuery(group.category, group.productType);

    try {
      console.log(`Searching: ${query}`);

      const photo = await searchUnsplash(query, group.productType);

      cache[key] = photo;
      processedKeys.add(key);

      if (photo) {
        searchesSucceeded++;
        console.log(`  Relevant photo found: ${photo.description}`);
        console.log(`  Photographer: ${photo.photographerName}`);
      } else {
        searchesEmpty++;
        console.log('  No reliable match. Database images will be preserved.');
      }

      if (isHairClipProduct(group.productType)) {
        const currentMeta = getCacheMeta(cache);
        cache[CACHE_META_KEY] = {
          ...currentMeta,
          __marketHubCacheMeta: true,
          hairClipRefreshDone: true,
        };
      }

      // Save progress after every completed search.
      await saveCache(cache);
    } catch (error) {
      searchesFailed++;

      console.error(
        `  Search failed for "${query}":`,
        error instanceof Error ? error.message : error,
      );

      // Leave failed searches uncached so a later run can retry them.
      break;
    }
  }

  let updatedProducts = 0;
  let skippedGroups = 0;

  // IMPORTANT:
  // Do not reapply old cache entries to the database. Only groups searched
  // successfully during this run can be updated.
  for (const key of processedKeys) {
    const group = groups.get(key)!;
    const photo = getCachedPhoto(cache[key]);

    // A missing or irrelevant result must never clear an existing image.
    if (!photo) {
      skippedGroups++;
      continue;
    }

    const result = await prisma.product.updateMany({
      where: {
        id: { in: group.ids },
        name: { startsWith: DEMO_PREFIX },
      },
      data: {
        imageUrl: photo.imageUrl,
      },
    });

    updatedProducts += result.count;
  }

  await saveCache(cache);

  const cachedGroups = [...groups.keys()].filter((key) =>
    Object.prototype.hasOwnProperty.call(cache, key),
  ).length;

  const remainingGroups = groups.size - cachedGroups;

  console.log('');
  console.log('========== IMAGE UPDATE SUMMARY ==========');
  console.log(`Demo products found: ${products.length}`);
  console.log(`Distinct product types: ${groups.size}`);
  console.log(`Searches with relevant photos: ${searchesSucceeded}`);
  console.log(`Searches without reliable matches: ${searchesEmpty}`);
  console.log(`Search requests failed: ${searchesFailed}`);
  console.log(`Products updated: ${updatedProducts}`);
  console.log(`Groups skipped to preserve existing images: ${skippedGroups}`);
  console.log(`Product types still awaiting search: ${remainingGroups}`);
  console.log(`Image cache: ${CACHE_PATH}`);
  console.log('');
  console.log('Existing non-demo products were not selected or updated.');
  console.log('Product names, prices, stock, and orders were not modified.');
  console.log(
    'Previously cached product images were not reapplied to the database.',
  );

  if (remainingGroups > 0) {
    console.log('');
    console.log(
      'Run the script again to process the next batch of product types.',
    );
  }

  console.log(
    'Please review storefront images before treating them as final.',
  );
}

main()
  .catch((error: unknown) => {
    console.error('Image correction failed.');

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
