/**
 * MENX Product Search & Relevance Engine
 * 
 * Provides intelligent query normalization, clothing-domain stemming, synonym matching,
 * menswear domain awareness, and deterministic relevance scoring.
 */

// Stop words that do not carry product specificity
const STOP_WORDS = new Set([
  'for', 'in', 'of', 'and', 'with', 'a', 'an', 'the', 'by', 'to', 'at', 'on', 'from', 'is', 'are', 'all'
]);

// Menswear domain modifier terms
const MENSWEAR_TERMS = new Set([
  'men', 'mens', 'male', 'man', 'menswear', 'menx', 'gentleman', 'gentlemen', 'boy', 'boys'
]);

// Controlled clothing-domain canonical stem & synonym groups
const SYNONYM_GROUPS = [
  ['shirt', 'shirts', 'shrt', 'shrts', 'buttondown', 'button-down'],
  ['tshirt', 'tshirts', 't-shirt', 't-shirts', 'tee', 'tees', 'polo', 'polos', 't shirt', 't shirts'],
  ['trouser', 'trousers', 'pant', 'pants', 'chino', 'chinos', 'slacks', 'bottom', 'bottoms'],
  ['jean', 'jeans', 'denim', 'denims'],
  ['shoe', 'shoes', 'footwear', 'boot', 'boots', 'sneaker', 'sneakers', 'loafer', 'loafers', 'sandal', 'sandals'],
  ['jacket', 'jackets', 'blazer', 'blazers', 'coat', 'coats', 'bomber', 'outerwear', 'hoodie', 'hoodies'],
  ['short', 'shorts'],
  ['kurta', 'kurtas', 'ethnic', 'ethnicwear', 'nehru'],
  ['activewear', 'sport', 'sports', 'athletic', 'gym', 'trackpant', 'trackpants', 'track pants'],
  ['accessory', 'accessories', 'belt', 'belts', 'wallet', 'wallets', 'cap', 'caps', 'sunglass', 'sunglasses', 'watch', 'watches', 'ring', 'rings'],
  ['formal', 'office', 'business', 'workwear', 'executive'],
  ['casual', 'everyday', 'daily', 'smartcasual', 'smart-casual'],
  ['slim', 'slimfit', 'slim-fit'],
  ['regular', 'regularfit', 'regular-fit'],
  ['oxford', 'oxford cotton'],
  ['cotton', 'longstaple']
];

// Build bidirectional lookup map for fast synonym expansion
const SYNONYM_MAP = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    const normalizedTerm = term.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!SYNONYM_MAP.has(normalizedTerm)) {
      SYNONYM_MAP.set(normalizedTerm, new Set());
    }
    const set = SYNONYM_MAP.get(normalizedTerm);
    for (const syn of group) {
      set.add(syn.toLowerCase());
      set.add(syn.toLowerCase().replace(/[^a-z0-9]/g, ''));
    }
  }
}

/**
 * Normalize raw search query or field text
 * Handles lowercase, unicode apostrophes, hyphens, possessives, and whitespace
 */
export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019`]/g, "'") // Unicode curly apostrophes
    .replace(/\bmen['’]?s\b/g, 'men') // Possessives like men's -> men
    .replace(/\bmale\b/g, 'men')
    .replace(/\bman\b/g, 'men')
    .replace(/\bgentlem[ae]n\b/g, 'men')
    .replace(/t-shirts?/g, 'tshirt')
    .replace(/t\s+shirts?/g, 'tshirt')
    .replace(/slim-fit/g, 'slimfit')
    .replace(/regular-fit/g, 'regularfit')
    .replace(/smart-casual/g, 'smartcasual')
    .replace(/button-down/g, 'buttondown')
    .replace(/[^a-z0-9\s]/g, ' ') // Strip remaining punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean and tokenize a search query into meaningful tokens
 */
export function tokenizeQuery(rawQuery) {
  const normalized = normalizeText(rawQuery);
  if (!normalized) return { raw: '', normalized: '', tokens: [], specificTokens: [], isDomainOnly: false };

  const allTokens = normalized.split(' ').filter(Boolean);
  const nonStopTokens = allTokens.filter(t => !STOP_WORDS.has(t));
  const tokens = nonStopTokens.length > 0 ? nonStopTokens : allTokens;

  const specificTokens = tokens.filter(t => !MENSWEAR_TERMS.has(t));
  const isDomainOnly = tokens.length > 0 && tokens.every(t => MENSWEAR_TERMS.has(t));

  return {
    raw: rawQuery,
    normalized,
    tokens,
    specificTokens,
    isDomainOnly
  };
}

/**
 * Get all synonym variations for a given token
 */
export function getSynonymsForToken(token) {
  const clean = token.toLowerCase().replace(/[^a-z0-9]/g, '');
  const variations = new Set([token.toLowerCase(), clean]);

  if (SYNONYM_MAP.has(clean)) {
    for (const syn of SYNONYM_MAP.get(clean)) {
      variations.add(syn);
    }
  }

  // Common plural/singular fallback if not in dictionary
  if (clean.endsWith('s') && clean.length > 3) {
    variations.add(clean.slice(0, -1));
  } else if (!clean.endsWith('s')) {
    variations.add(`${clean}s`);
  }

  return Array.from(variations);
}

/**
 * Determine whether a product qualifies as MENX menswear from existing database fields
 */
export function isProductMenswear(product) {
  if (!product) return false;

  // 1. Tag signals
  const tags = Array.isArray(product.tags) ? product.tags.map(t => normalizeText(t)) : [];
  if (tags.some(t => t === 'menswear' || t === 'men' || t === 'menx' || t.includes('menswear'))) {
    return true;
  }

  // 2. Brand signals
  const brandName = normalizeText(product.brand?.name || '');
  const brandSlug = normalizeText(product.brand?.slug || '');
  if (brandName.includes('menx') || brandSlug.includes('menx')) {
    return true;
  }

  // 3. Category / Subcategory signals in MENX catalog
  const catName = normalizeText(product.category?.name || '');
  const catSlug = normalizeText(product.category?.slug || '');
  const menswearCats = ['shirts', 'tshirts', 't-shirts', 't-shirt', 'jeans', 'trousers', 'shorts', 'jackets', 'ethnicwear', 'ethnic wear', 'activewear', 'footwear', 'accessories', 'rings', 'apparel'];
  if (menswearCats.some(c => catSlug.includes(c) || catName.includes(c))) {
    return true;
  }

  // 4. Variant size category type signals
  if (Array.isArray(product.variants) && product.variants.some(v => v.size?.category_type)) {
    return true;
  }

  // 5. Default true for MENX store catalog items
  return true;
}

/**
 * Calculate deterministic relevance score for a product against a search query
 * Returns score > 0 if product matches, or 0 if product is not relevant.
 */
export function calculateProductSearchRelevance(product, rawQuery) {
  const queryMeta = tokenizeQuery(rawQuery);
  const { normalized: query, tokens, specificTokens, isDomainOnly } = queryMeta;

  if (!query) return 1; // No search query -> all products match equally

  const isMenswear = isProductMenswear(product);

  // Extract and normalize all searchable product metadata
  const pTitle = normalizeText(product.title);
  const pDesc = normalizeText(product.description);
  const pCatName = normalizeText(product.category?.name || '');
  const pCatSlug = normalizeText(product.category?.slug || '');
  const pSubcatName = normalizeText(product.subcategory?.name || '');
  const pSubcatSlug = normalizeText(product.subcategory?.slug || '');
  const pBrandName = normalizeText(product.brand?.name || '');
  const pBrandSlug = normalizeText(product.brand?.slug || '');
  const pMaterial = normalizeText(product.material || '');
  const pCare = normalizeText(product.care_instructions || product.careInstructions || '');
  const pTags = Array.isArray(product.tags) ? product.tags.map(t => normalizeText(t)) : [];

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const pColors = variants.map(v => normalizeText(v.color?.name || '')).filter(Boolean);
  const pSizes = variants.map(v => normalizeText(v.size?.name || '')).filter(Boolean);

  let score = 0;

  // -------------------------------------------------------------
  // 1. EXACT & SUBSTRING MATCHES
  // -------------------------------------------------------------
  if (pTitle === query) {
    score += 150;
  } else if (pTitle.includes(query)) {
    score += 100;
  }

  if (pCatName === query || pCatSlug === query) {
    score += 90;
  } else if (pCatName.includes(query) || pCatSlug.includes(query)) {
    score += 45;
  }

  if (pSubcatName === query || pSubcatSlug === query) {
    score += 80;
  } else if (pSubcatName.includes(query) || pSubcatSlug.includes(query)) {
    score += 40;
  }

  if (pBrandName === query || pBrandSlug === query) {
    score += 70;
  } else if (pBrandName.includes(query) || pBrandSlug.includes(query)) {
    score += 35;
  }

  if (pDesc.includes(query)) {
    score += 15;
  }

  // -------------------------------------------------------------
  // 2. DOMAIN-ONLY QUERY HANDLING ("men", "mens", "men's", "male")
  // -------------------------------------------------------------
  if (isDomainOnly) {
    if (!isMenswear) return 0;

    score += 50; // Base menswear domain score
    if (pTags.includes('menswear') || pTags.includes('men')) score += 30;
    if (pBrandName.includes('menx') || pBrandSlug.includes('menx')) score += 20;
    if (product.is_featured || product.isFeatured) score += 10;
    return score;
  }

  // -------------------------------------------------------------
  // 3. MULTI-TOKEN / SPECIFIC-TERM MATCHING
  // -------------------------------------------------------------
  // If specific tokens exist (e.g. "shirt" in "mens shirts"), prioritize them
  const activeTokens = specificTokens.length > 0 ? specificTokens : tokens;
  let matchedSpecificCount = 0;

  for (const token of activeTokens) {
    const synonyms = getSynonymsForToken(token);
    let tokenMatched = false;

    // A. Title match (+40 per token)
    for (const syn of synonyms) {
      if (pTitle.includes(syn)) {
        score += 40;
        tokenMatched = true;
        break;
      }
    }

    // B. Category match (+40 per token)
    for (const syn of synonyms) {
      if (pCatName.includes(syn) || pCatSlug.includes(syn)) {
        score += 40;
        tokenMatched = true;
        break;
      }
    }

    // C. Subcategory match (+30 per token)
    for (const syn of synonyms) {
      if (pSubcatName.includes(syn) || pSubcatSlug.includes(syn)) {
        score += 30;
        tokenMatched = true;
        break;
      }
    }

    // D. Brand match (+25 per token)
    for (const syn of synonyms) {
      if (pBrandName.includes(syn) || pBrandSlug.includes(syn)) {
        score += 25;
        tokenMatched = true;
        break;
      }
    }

    // E. Tags match (+25 per token)
    for (const syn of synonyms) {
      if (pTags.some(t => t === syn || t.includes(syn))) {
        score += 25;
        tokenMatched = true;
        break;
      }
    }

    // F. Material match (+20 per token)
    for (const syn of synonyms) {
      if (pMaterial.includes(syn)) {
        score += 20;
        tokenMatched = true;
        break;
      }
    }

    // G. Care instructions match (+10 per token)
    for (const syn of synonyms) {
      if (pCare.includes(syn)) {
        score += 10;
        tokenMatched = true;
        break;
      }
    }

    // H. Description match (+15 per token)
    for (const syn of synonyms) {
      if (pDesc.includes(syn)) {
        score += 15;
        tokenMatched = true;
        break;
      }
    }

    // I. Variant color or size match (+15 per token)
    for (const syn of synonyms) {
      if (pColors.some(c => c.includes(syn)) || pSizes.some(s => s === syn || s.toLowerCase() === syn)) {
        score += 15;
        tokenMatched = true;
        break;
      }
    }

    if (tokenMatched) {
      matchedSpecificCount++;
    }
  }

  // If the query contains specific clothing terms, but none matched this product, product is NOT relevant
  if (activeTokens.length > 0 && matchedSpecificCount === 0) {
    return 0;
  }

  // Bonus for matching all meaningful tokens (+30)
  if (activeTokens.length > 1 && matchedSpecificCount === activeTokens.length) {
    score += 30;
  }

  // Domain confirmation bonus if query included menswear modifier ("mens shirts" -> shirt matches + menswear verified)
  const hasDomainModifier = tokens.some(t => MENSWEAR_TERMS.has(t));
  if (hasDomainModifier && isMenswear && matchedSpecificCount > 0) {
    score += 20;
    if (pTags.includes('menswear')) score += 10;
  }

  return score;
}

/**
 * Filter and rank an array of products based on search query, sorting, and pagination
 */
export function searchAndRankProducts(products, { search, sortBy = 'newest', page = 1, limit = 12 } = {}) {
  const trimmedSearch = (search || '').trim();

  // 1. Calculate relevance scores
  let scoredItems = products.map(product => {
    const score = trimmedSearch ? calculateProductSearchRelevance(product, trimmedSearch) : 1;
    return { product, score };
  });

  // 2. Filter out non-matching products if search is active
  if (trimmedSearch) {
    scoredItems = scoredItems.filter(item => item.score > 0);
  }

  // 3. Sorting
  const isExplicitSort = ['price-asc', 'price-desc', 'name-asc', 'name-desc'].includes(sortBy);

  scoredItems.sort((a, b) => {
    // If user explicitly selected a sorting criterion, respect it
    if (isExplicitSort) {
      if (sortBy === 'price-asc') {
        const priceA = a.product.price?.sellingPrice ?? a.product.base_price ?? 0;
        const priceB = b.product.price?.sellingPrice ?? b.product.base_price ?? 0;
        return priceA - priceB;
      }
      if (sortBy === 'price-desc') {
        const priceA = a.product.price?.sellingPrice ?? a.product.base_price ?? 0;
        const priceB = b.product.price?.sellingPrice ?? b.product.base_price ?? 0;
        return priceB - priceA;
      }
      if (sortBy === 'name-asc') {
        return (a.product.title || '').localeCompare(b.product.title || '');
      }
      if (sortBy === 'name-desc') {
        return (b.product.title || '').localeCompare(a.product.title || '');
      }
    }

    // If searching and default sort ('newest' or unset), sort by relevance score DESC, then created_at DESC
    if (trimmedSearch) {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
    }

    // Default chronological sort
    const dateA = new Date(a.product.created_at || a.product.createdAt || 0).getTime();
    const dateB = new Date(b.product.created_at || b.product.createdAt || 0).getTime();
    return dateB - dateA;
  });

  const matchingProducts = scoredItems.map(item => item.product);

  // 4. Pagination
  const total = matchingProducts.length;
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.max(1, parseInt(limit, 10) || 12);
  const totalPages = Math.ceil(total / parsedLimit) || 1;
  const offset = (parsedPage - 1) * parsedLimit;
  const pagedItems = matchingProducts.slice(offset, offset + parsedLimit);

  return {
    items: pagedItems,
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages,
      hasNextPage: parsedPage < totalPages,
      hasPrevPage: parsedPage > 1
    }
  };
}
