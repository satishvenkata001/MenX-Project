/**
 * MENX Frontend Formatting & Normalization Utilities
 * Handles camelCase, snake_case, null/undefined, and object shapes defensively.
 */

/**
 * Safely format an amount as Indian Rupee string (e.g. "₹1,499").
 * Never returns empty "₹" or "₹NaN".
 *
 * @param {number|string|null|undefined} amount 
 * @param {boolean} includeSymbol - default true
 * @returns {string} e.g. "₹1,299" or "1,299"
 */
export function formatCurrency(amount, includeSymbol = true) {
  if (amount === null || amount === undefined || amount === '') {
    return includeSymbol ? '₹0' : '0';
  }
  const numeric = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.-]+/g, ''));
  if (isNaN(numeric)) {
    return includeSymbol ? '₹0' : '0';
  }
  const formatted = numeric.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });
  return includeSymbol ? `₹${formatted}` : formatted;
}

/**
 * Safely extract a numeric price value from mixed field names
 *
 * @param {number|string|null|undefined} val 
 * @param {number} fallback 
 * @returns {number}
 */
export function getNumericPrice(val, fallback = 0) {
  if (val === null || val === undefined || val === '') return fallback;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  return isNaN(num) ? fallback : num;
}

/**
 * Safely extract pricing fields from a product or variant object.
 * Handles both camelCase and snake_case shapes.
 *
 * @param {object|null|undefined} product 
 * @param {object|null|undefined} variant 
 * @returns {{ mrp: number, sellingPrice: number, hasDiscount: boolean, discountPercent: number }}
 */
export function getProductPrice(product, variant = null) {
  let mrp = 0;
  let sellingPrice = 0;

  if (variant) {
    mrp = getNumericPrice(variant.mrp ?? variant.baseMrp ?? variant.base_mrp);
    sellingPrice = getNumericPrice(variant.sellingPrice ?? variant.selling_price ?? variant.price ?? mrp);
  } else if (product) {
    if (product.price && typeof product.price === 'object') {
      mrp = getNumericPrice(product.price.mrp ?? product.price.baseMrp ?? product.price.base_mrp);
      sellingPrice = getNumericPrice(product.price.sellingPrice ?? product.price.selling_price ?? product.price.basePrice ?? product.price.base_price ?? mrp);
    } else {
      mrp = getNumericPrice(product.mrp ?? product.baseMrp ?? product.base_mrp);
      sellingPrice = getNumericPrice(product.sellingPrice ?? product.selling_price ?? product.basePrice ?? product.base_price ?? mrp);
    }
  }

  if (sellingPrice === 0 && mrp > 0) {
    sellingPrice = mrp;
  }
  if (mrp === 0 && sellingPrice > 0) {
    mrp = sellingPrice;
  }

  const hasDiscount = mrp > 0 && sellingPrice > 0 && sellingPrice < mrp;
  const discountPercent = hasDiscount ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;

  return {
    mrp,
    sellingPrice,
    hasDiscount,
    discountPercent
  };
}

/**
 * Safely extract a string label from a field that may be an object or string
 * e.g., size: { id: "...", name: "M" } or size: "M"
 *
 * @param {object|string|null|undefined} entity 
 * @param {string} fallback 
 * @returns {string}
 */
export function getSafeLabel(entity, fallback = 'N/A') {
  if (!entity) return fallback;
  if (typeof entity === 'string') return entity.trim() || fallback;
  if (typeof entity === 'object') {
    return entity.name || entity.code || entity.title || entity.slug || fallback;
  }
  return String(entity);
}

/**
 * Format timestamp safely
 *
 * @param {string|number|Date|null|undefined} dateVal 
 * @param {boolean} includeTime 
 * @returns {string}
 */
export function formatDate(dateVal, includeTime = false) {
  if (!dateVal) return 'N/A';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'N/A';
    return includeTime ? d.toLocaleString('en-IN') : d.toLocaleDateString('en-IN');
  } catch {
    return 'N/A';
  }
}

/**
 * Resolves normalized stock and availability information for a variant or product.
 * Server-authoritative: handles availability enum ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'),
 * numeric stock fields (availableStock, quantityAvailable, quantity_available, stock, quantity),
 * and isActive flags across different API shapes.
 *
 * @param {object|null|undefined} variant
 * @returns {{ inStock: boolean, isLowStock: boolean, isOutOfStock: boolean, status: 'IN_STOCK'|'LOW_STOCK'|'OUT_OF_STOCK', label: string, quantity: number|null }}
 */
export function getVariantStock(variant) {
  if (!variant) {
    return {
      inStock: false,
      isLowStock: false,
      isOutOfStock: true,
      status: 'OUT_OF_STOCK',
      label: 'Out of Stock',
      quantity: 0
    };
  }

  // If variant is explicitly inactive
  if (variant.isActive === false || variant.is_active === false) {
    return {
      inStock: false,
      isLowStock: false,
      isOutOfStock: true,
      status: 'OUT_OF_STOCK',
      label: 'Unavailable',
      quantity: 0
    };
  }

  // Extract numeric quantity if present
  const rawQty = variant.availableStock ?? variant.quantityAvailable ?? variant.quantity_available ?? variant.stock ?? variant.quantity;
  const numQty = typeof rawQty === 'number'
    ? rawQty
    : (rawQty !== undefined && rawQty !== null && String(rawQty).trim() !== '' && !isNaN(Number(rawQty)) ? Number(rawQty) : null);

  // Extract status string
  const rawStatus = String(variant.availability || variant.status || '').trim().toUpperCase();

  // If numeric quantity is available, it is the most specific representation
  if (numQty !== null) {
    if (numQty <= 0) {
      return {
        inStock: false,
        isLowStock: false,
        isOutOfStock: true,
        status: 'OUT_OF_STOCK',
        label: 'Out of Stock',
        quantity: 0
      };
    }
    const isLow = numQty <= 5 || rawStatus === 'LOW_STOCK';
    return {
      inStock: true,
      isLowStock: isLow,
      isOutOfStock: false,
      status: isLow ? 'LOW_STOCK' : 'IN_STOCK',
      label: isLow ? `Only ${numQty} left in stock` : 'In Stock',
      quantity: numQty
    };
  }

  // Fallback to availability status enum
  if (rawStatus === 'IN_STOCK') {
    return {
      inStock: true,
      isLowStock: false,
      isOutOfStock: false,
      status: 'IN_STOCK',
      label: 'In Stock',
      quantity: null
    };
  }

  if (rawStatus === 'LOW_STOCK') {
    return {
      inStock: true,
      isLowStock: true,
      isOutOfStock: false,
      status: 'LOW_STOCK',
      label: 'Low Stock',
      quantity: null
    };
  }

  // Default to Out of Stock for safety
  return {
    inStock: false,
    isLowStock: false,
    isOutOfStock: true,
    status: 'OUT_OF_STOCK',
    label: 'Out of Stock',
    quantity: 0
  };
}

