/**
 * Category-Based Product Variant Size System Configuration & Helpers for Frontend
 */

export const CATEGORY_SIZE_RULES = {
  't-shirts': {
    label: 'T-Shirts',
    categoryType: 'APPAREL',
    allowedSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  },
  'shirts': {
    label: 'Shirts',
    categoryType: 'APPAREL',
    allowedSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  },
  'jackets': {
    label: 'Jackets',
    categoryType: 'APPAREL',
    allowedSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  },
  'activewear': {
    label: 'Activewear',
    categoryType: 'APPAREL',
    allowedSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  },
  'ethnic-wear': {
    label: 'Ethnic Wear',
    categoryType: 'APPAREL',
    allowedSizes: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  },
  'jeans': {
    label: 'Jeans',
    categoryType: 'BOTTOMWEAR',
    allowedSizes: ['28', '30', '32', '34', '36', '38', '40', '42', '44']
  },
  'trousers': {
    label: 'Trousers',
    categoryType: 'BOTTOMWEAR',
    allowedSizes: ['28', '30', '32', '34', '36', '38', '40', '42', '44']
  },
  'shorts': {
    label: 'Shorts',
    categoryType: 'BOTTOMWEAR',
    allowedSizes: ['28', '30', '32', '34', '36', '38', '40', '42', '44']
  },
  'footwear': {
    label: 'Footwear',
    categoryType: 'FOOTWEAR',
    allowedSizes: ['6', '7', '8', '9', '10', '11', '12']
  },
  'accessories': {
    label: 'Accessories',
    categoryType: 'ACCESSORIES',
    allowedSizes: ['One Size']
  }
};

/**
 * Normalizes category and optional subcategory into a canonical slug key.
 */
export function normalizeCategoryKey(category, subcategory) {
  const getRaw = (item) => {
    if (!item) return '';
    if (typeof item === 'string') return item.toLowerCase().trim();
    return (item.slug || item.name || '').toLowerCase().trim();
  };

  const catRaw = getRaw(category);
  const subRaw = getRaw(subcategory);
  const slug = catRaw.replace(/[\s_]+/g, '-');

  if (CATEGORY_SIZE_RULES[slug]) {
    return slug;
  }

  // Substring / alias matching for category and subcategory
  if (
    slug.includes('jean') || slug.includes('denim') ||
    slug.includes('trouser') || slug.includes('pant') ||
    slug.includes('chino') || slug.includes('short') ||
    slug.includes('bottomwear') || slug.includes('bottom') ||
    slug.includes('jogger')
  ) {
    if (slug.includes('short')) return 'shorts';
    if (slug.includes('trouser') || slug.includes('pant') || slug.includes('chino') || slug.includes('jogger') || slug.includes('bottom')) return 'trousers';
    return 'jeans';
  }

  if (slug.includes('footwear') || slug.includes('shoe') || slug.includes('sneaker') || slug.includes('sandal') || slug.includes('boot')) {
    return 'footwear';
  }

  if (slug.includes('accessor') || slug.includes('belt') || slug.includes('wallet') || slug.includes('cap') || slug.includes('hat') || slug.includes('watch') || slug.includes('sock')) {
    return 'accessories';
  }

  if (slug.includes('ethnic') || slug.includes('kurta') || slug.includes('sherwani') || slug.includes('nehru')) {
    return 'ethnic-wear';
  }

  if (slug.includes('t-shirt') || slug.includes('tshirt') || slug.includes('tee')) return 't-shirts';
  if (slug.includes('jacket') || slug.includes('coat') || slug.includes('blazer') || slug.includes('hoodie')) return 'jackets';
  if (slug.includes('activewear') || slug.includes('sportswear')) return 'activewear';
  if (slug.includes('shirt')) return 'shirts';
  if (slug.includes('apparel') || slug.includes('cloth')) return 'shirts';

  return slug;
}

/**
 * Returns the category size rule for a given category.
 */
export function getCategorySizeRule(category, subcategory) {
  const key = normalizeCategoryKey(category, subcategory);
  if (CATEGORY_SIZE_RULES[key]) {
    return { categoryKey: key, ...CATEGORY_SIZE_RULES[key] };
  }

  return {
    categoryKey: key || 'unknown',
    label: typeof category === 'string' ? category : (category?.name || 'Unknown'),
    categoryType: 'APPAREL',
    allowedSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  };
}

/**
 * Filters and sorts sizes for a given category.
 * Returns only valid sizes sorted in canonical display order.
 */
export function filterSizesForCategory(category, sizes = [], subcategory = null) {
  if (!Array.isArray(sizes) || sizes.length === 0) return [];

  const rule = getCategorySizeRule(category, subcategory);

  // Filter out test fixture names and check against allowedSizes
  const valid = sizes.filter(s => {
    if (!s || !s.name) return false;
    const trimmed = s.name.trim();
    // Filter out dynamic timestamp fixtures (e.g. 28-1788791778586, Size-L-1789300242079)
    if (/-\d{10,}$/.test(trimmed) || /^Size-[A-Za-z0-9]+-\d+/i.test(trimmed)) return false;

    // Must match category_type if present
    if (s.category_type && rule.categoryType && s.category_type.toUpperCase() !== rule.categoryType.toUpperCase()) {
      return false;
    }

    // Must be in the allowed size list for this category
    return rule.allowedSizes.some(allowed => allowed.toLowerCase() === trimmed.toLowerCase());
  });

  // Deduplicate by name
  const seen = new Set();
  const deduped = valid.filter(s => {
    const key = s.name.trim().toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort according to the rule's canonical allowedSizes order
  return deduped.sort((a, b) => {
    const idxA = rule.allowedSizes.findIndex(sz => sz.toLowerCase() === a.name.trim().toLowerCase());
    const idxB = rule.allowedSizes.findIndex(sz => sz.toLowerCase() === b.name.trim().toLowerCase());
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

/**
 * Normalizes, cleans, and deduplicates customer-facing filter sizes.
 * If a category is selected, filters to valid sizes for that category.
 * If no category is selected, returns all valid clean sizes in logical fashion order.
 */
export function getFilterSizes(category, allSizes = [], subcategory = null) {
  if (!Array.isArray(allSizes) || allSizes.length === 0) return [];

  if (category) {
    return filterSizesForCategory(category, allSizes, subcategory);
  }

  // When no category is selected: clean, deduplicate, and sort logically
  const seen = new Set();
  const clean = allSizes.filter(s => {
    if (!s || !s.name) return false;
    const trimmed = s.name.trim();
    if (!trimmed) return false;
    // Filter out dynamic timestamp fixtures
    if (/-\d{10,}$/.test(trimmed) || /^Size-[A-Za-z0-9]+-\d+/i.test(trimmed)) return false;

    const key = trimmed.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Logical sorting order across all categories:
  // APPAREL (XS-XXXL) -> BOTTOMWEAR (28-44) -> FOOTWEAR (6-12) -> ACCESSORIES (One Size)
  const canonicalOrder = [
    'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL',
    '28', '30', '32', '34', '36', '38', '40', '42', '44',
    '6', '7', '8', '9', '10', '11', '12',
    'One Size', 'Free Size'
  ];

  return clean.sort((a, b) => {
    const idxA = canonicalOrder.findIndex(sz => sz.toLowerCase() === a.name.trim().toLowerCase());
    const idxB = canonicalOrder.findIndex(sz => sz.toLowerCase() === b.name.trim().toLowerCase());
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

/**
 * Normalizes, cleans, and deduplicates customer-facing filter colors.
 * Excludes test fixtures, resolves clean display names for hex values, and deduplicates.
 */
export function getFilterColors(allColors = []) {
  if (!Array.isArray(allColors) || allColors.length === 0) return [];

  const seen = new Set();
  return allColors
    .filter(c => {
      if (!c || !c.name) return false;
      const trimmed = c.name.trim();
      if (!trimmed) return false;
      // Filter out test fixture names and timestamps
      if (/-\d{10,}$/.test(trimmed) || /^Test\s+.*-\d+/i.test(trimmed) || /^DupColor-\d+/i.test(trimmed)) {
        return false;
      }
      return true;
    })
    .map(c => {
      let name = c.name.trim();
      return {
        ...c,
        name,
        hex_code: c.hex_code || (name.startsWith('#') ? name : '#6B7280')
      };
    })
    .filter(c => {
      const key = c.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
