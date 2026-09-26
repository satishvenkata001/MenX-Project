import { api } from './api.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for static taxonomy
const PRODUCT_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes for product details

const cache = {
  categories: { data: null, timestamp: 0, pending: null },
  subcategories: { data: null, timestamp: 0, pending: null },
  brands: { data: null, timestamp: 0, pending: null },
  sizes: { data: null, timestamp: 0, pending: null },
  colors: { data: null, timestamp: 0, pending: null }
};

// In-memory bounded LRU-like Map for product details by slug
const productDetailCache = new Map();
const MAX_PRODUCT_CACHE_ENTRIES = 50;

// In-memory cache for customer orders and support requests
const ordersCache = { data: null, timestamp: 0, pending: null };
const ORDERS_CACHE_TTL_MS = 60 * 1000; // 1 minute

const supportTicketsCache = new Map();
const MAX_SUPPORT_CACHE_ENTRIES = 20;
const SUPPORT_CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Generic helper to get cached metadata item or fetch if stale/missing
 */
async function getCachedItem(key, endpoint, forceRefresh = false) {
  const now = Date.now();
  const entry = cache[key];

  if (forceRefresh) {
    entry.data = null;
    entry.timestamp = 0;
    entry.pending = null;
  } else {
    // Return existing valid cached data
    if (entry.data && (now - entry.timestamp < CACHE_TTL_MS)) {
      return entry.data;
    }

    // Deduplicate inflight requests
    if (entry.pending) {
      return entry.pending;
    }
  }

  entry.pending = api.get(endpoint)
    .then(res => {
      const data = res.data || [];
      entry.data = data;
      entry.timestamp = Date.now();
      entry.pending = null;
      return data;
    })
    .catch(err => {
      entry.pending = null;
      if (entry.data) return entry.data; // fallback to stale on error
      throw err;
    });

  return entry.pending;
}

/**
 * Fetches all catalog metadata in parallel or returns cached
 */
export async function getCatalogMetadata(forceRefresh = false) {
  if (forceRefresh) {
    invalidateMetadataCache();
  }

  const [categories, subcategories, brands, sizes, colors] = await Promise.all([
    getCachedItem('categories', '/categories', forceRefresh),
    getCachedItem('subcategories', '/subcategories', forceRefresh),
    getCachedItem('brands', '/brands', forceRefresh),
    getCachedItem('sizes', '/sizes', forceRefresh),
    getCachedItem('colors', '/colors', forceRefresh)
  ]);

  return {
    categories,
    subcategories,
    brands,
    sizes,
    colors
  };
}

export function getCachedCategories(forceRefresh = false) {
  return getCachedItem('categories', '/categories', forceRefresh);
}

export function getCachedSubcategories(forceRefresh = false) {
  return getCachedItem('subcategories', '/subcategories', forceRefresh);
}

export function getCachedBrands(forceRefresh = false) {
  return getCachedItem('brands', '/brands', forceRefresh);
}

export function getCachedSizes(forceRefresh = false) {
  return getCachedItem('sizes', '/sizes', forceRefresh);
}

export function getCachedColors(forceRefresh = false) {
  return getCachedItem('colors', '/colors', forceRefresh);
}

/**
 * Synchronously checks if a product detail is present in memory cache
 */
export function getMemoryCachedProduct(slug) {
  if (!slug) return null;
  const cached = productDetailCache.get(slug);
  if (cached && cached.data) {
    return cached.data;
  }
  return null;
}

/**
 * Retrieves cached product details or fetches from API if missing/stale
 */
export async function getCachedProductDetail(slug, forceRefresh = false, options = {}) {
  if (!slug) return null;
  const now = Date.now();
  const cached = productDetailCache.get(slug);

  if (!forceRefresh && cached && cached.data && (now - cached.timestamp < PRODUCT_CACHE_TTL_MS)) {
    return cached.data;
  }

  if (cached && cached.pending && !forceRefresh) {
    return cached.pending;
  }

  const pendingPromise = api.get(`/products/${slug}`, options)
    .then(res => {
      const product = res.data;
      if (productDetailCache.size >= MAX_PRODUCT_CACHE_ENTRIES) {
        const oldestKey = productDetailCache.keys().next().value;
        if (oldestKey) productDetailCache.delete(oldestKey);
      }
      productDetailCache.set(slug, {
        data: product,
        timestamp: Date.now(),
        pending: null
      });
      recordProductMeta(product);
      return product;
    })
    .catch(err => {
      if (cached) {
        cached.pending = null;
        if (cached.data) return cached.data;
      }
      throw err;
    });

  if (!cached) {
    productDetailCache.set(slug, {
      data: null,
      timestamp: 0,
      pending: pendingPromise
    });
  } else {
    cached.pending = pendingPromise;
  }

  return pendingPromise;
}

/**
 * In-memory mapping of product slug -> { id, slug, title, thumbnailUrl, categorySlug, categoryName }
 */
const productMetaCache = new Map();
const MAX_META_CACHE_ENTRIES = 100;

export function recordProductMeta(item) {
  if (!item || !item.slug) return;
  const catSlug = item.category?.slug || (typeof item.category === 'string' ? item.category : '') || item.categorySlug || '';
  const catName = item.category?.name || item.categoryName || '';

  if (productMetaCache.size >= MAX_META_CACHE_ENTRIES) {
    const oldestKey = productMetaCache.keys().next().value;
    if (oldestKey) productMetaCache.delete(oldestKey);
  }

  productMetaCache.set(item.slug, {
    id: item.id,
    slug: item.slug,
    title: item.title,
    thumbnailUrl: item.thumbnailUrl,
    categorySlug: catSlug,
    categoryName: catName
  });
}

export function getRecordedProductMeta(slug) {
  if (!slug) return null;
  return productMetaCache.get(slug) || null;
}

// In-memory cache for similar products by category slug (2 minute TTL)
const similarProductsCache = new Map();
const SIMILAR_CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_SIMILAR_CACHE_ENTRIES = 20;

export async function getCachedSimilarProducts(categorySlug, options = {}) {
  const cacheKey = categorySlug || '__all__';
  const now = Date.now();
  const cached = similarProductsCache.get(cacheKey);

  if (cached && cached.data && (now - cached.timestamp < SIMILAR_CACHE_TTL_MS)) {
    return cached.data;
  }

  if (cached && cached.pending) {
    return cached.pending;
  }

  const queryUrl = categorySlug ? `/products?category=${encodeURIComponent(categorySlug)}&limit=5` : '/products?limit=5';
  const pending = api.get(queryUrl, options)
    .then(res => {
      const list = Array.isArray(res.data) ? res.data : (res.data?.products || []);
      if (similarProductsCache.size >= MAX_SIMILAR_CACHE_ENTRIES) {
        const oldest = similarProductsCache.keys().next().value;
        if (oldest) similarProductsCache.delete(oldest);
      }
      similarProductsCache.set(cacheKey, {
        data: list,
        timestamp: Date.now(),
        pending: null
      });
      return list;
    })
    .catch(err => {
      if (cached) {
        cached.pending = null;
        if (cached.data) return cached.data;
      }
      throw err;
    });

  if (!cached) {
    similarProductsCache.set(cacheKey, {
      data: null,
      timestamp: 0,
      pending
    });
  } else {
    cached.pending = pending;
  }

  return pending;
}

/**
 * Invalidate specific product cache entry or entire product cache
 */
export function invalidateProductCache(slugOrId) {
  similarProductsCache.clear();
  if (slugOrId) {
    productDetailCache.delete(slugOrId);
    productMetaCache.delete(slugOrId);
    // Also scan entries for matching product.id or product.slug
    for (const [key, val] of productDetailCache.entries()) {
      if (val.data?.id === slugOrId || val.data?.slug === slugOrId || key === slugOrId) {
        productDetailCache.delete(key);
      }
    }
  } else {
    productDetailCache.clear();
    productMetaCache.clear();
  }
}

/**
 * Invalidate metadata cache (e.g. after admin category/brand mutation)
 */
export function invalidateMetadataCache(key) {
  if (key && cache[key]) {
    cache[key].data = null;
    cache[key].timestamp = 0;
    cache[key].pending = null;
  } else {
    for (const k in cache) {
      cache[k].data = null;
      cache[k].timestamp = 0;
      cache[k].pending = null;
    }
    productDetailCache.clear();
  }
}

export function invalidateCategoryCache() {
  invalidateMetadataCache('categories');
}

export function invalidateSubcategoryCache() {
  invalidateMetadataCache('subcategories');
}

export function invalidateBrandCache() {
  invalidateMetadataCache('brands');
}

export function invalidateColorCache() {
  invalidateMetadataCache('colors');
}

export function invalidateSizeCache() {
  invalidateMetadataCache('sizes');
}

/**
 * Synchronously checks if orders list is present in memory cache
 */
export function getMemoryCachedOrders() {
  return ordersCache.data;
}

/**
 * Retrieves cached customer orders or fetches from API if missing/stale
 */
export async function getCachedOrders(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && ordersCache.data && (now - ordersCache.timestamp < ORDERS_CACHE_TTL_MS)) {
    return ordersCache.data;
  }

  if (ordersCache.pending) {
    return ordersCache.pending;
  }

  ordersCache.pending = api.get('/orders?limit=20')
    .then(res => {
      const orders = res.data?.orders || [];
      ordersCache.data = orders;
      ordersCache.timestamp = Date.now();
      ordersCache.pending = null;
      return orders;
    })
    .catch(err => {
      ordersCache.pending = null;
      if (ordersCache.data) return ordersCache.data;
      throw err;
    });

  return ordersCache.pending;
}

export function setCachedOrders(orders) {
  ordersCache.data = Array.isArray(orders) ? orders : [];
  ordersCache.timestamp = Date.now();
}

export function invalidateOrdersCache() {
  ordersCache.data = null;
  ordersCache.timestamp = 0;
  ordersCache.pending = null;
}

/**
 * Support Tickets Cache
 */
export function getMemoryCachedSupportTickets(queryKey) {
  const cached = supportTicketsCache.get(queryKey);
  return cached?.data || null;
}

export async function getCachedSupportTickets(queryKey, fetcher, forceRefresh = false) {
  const now = Date.now();
  const cached = supportTicketsCache.get(queryKey);

  if (!forceRefresh && cached && cached.data && (now - cached.timestamp < SUPPORT_CACHE_TTL_MS)) {
    return cached.data;
  }

  if (cached && cached.pending) {
    return cached.pending;
  }

  const pendingPromise = fetcher()
    .then(data => {
      if (supportTicketsCache.size >= MAX_SUPPORT_CACHE_ENTRIES) {
        const oldestKey = supportTicketsCache.keys().next().value;
        if (oldestKey) supportTicketsCache.delete(oldestKey);
      }
      supportTicketsCache.set(queryKey, {
        data,
        timestamp: Date.now(),
        pending: null
      });
      return data;
    })
    .catch(err => {
      if (cached) {
        cached.pending = null;
        if (cached.data) return cached.data;
      }
      throw err;
    });

  if (!cached) {
    supportTicketsCache.set(queryKey, {
      data: null,
      timestamp: 0,
      pending: pendingPromise
    });
  } else {
    cached.pending = pendingPromise;
  }

  return pendingPromise;
}

export function invalidateSupportCache() {
  supportTicketsCache.clear();
}


