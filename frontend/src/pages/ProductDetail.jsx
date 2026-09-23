import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import {
  ShoppingBag,
  Heart,
  ArrowLeft,
  ShieldAlert,
  Check,
  ChevronLeft,
  ChevronRight,
  Zap,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Truck,
  RotateCcw,
  ShieldCheck
} from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';
import { formatCurrency, getProductPrice, getVariantStock, getSafeLabel } from '../utils/formatters.js';
import { getCachedColors, getCachedProductDetail, getMemoryCachedProduct } from '../utils/metadataCache.js';

/**
 * Resolves normalized size name string for a variant or size field.
 */
export function getVariantSizeName(v) {
  if (!v) return '';
  const rawSize = v.size !== undefined ? v.size : (v.sizes || v.sizeDetails || null);
  if (rawSize === null || rawSize === undefined) return '';
  if (typeof rawSize === 'object') {
    return String(rawSize.name || rawSize.size || rawSize.value || rawSize.label || '').trim();
  }
  return String(rawSize).trim();
}

/**
 * Resolves normalized size info { id, name, canonicalKey } for a variant or size field.
 */
export function getVariantSizeInfo(v) {
  if (!v) return { id: '', name: '', canonicalKey: '' };
  const rawSize = v.size !== undefined ? v.size : (v.sizes || v.sizeDetails || null);
  let sizeId = v.sizeId || v.size_id || '';
  let sizeName = '';

  if (rawSize && typeof rawSize === 'object') {
    sizeId = rawSize.id || sizeId || '';
    sizeName = String(rawSize.name || rawSize.size || rawSize.value || rawSize.label || '').trim();
  } else if (rawSize !== null && rawSize !== undefined) {
    sizeName = String(rawSize).trim();
  }

  const canonicalKey = sizeId ? String(sizeId).trim().toLowerCase() : String(sizeName).trim().toLowerCase();
  return {
    id: sizeId || sizeName,
    name: sizeName,
    canonicalKey
  };
}

/**
 * Resolves normalized color info { id, name, hexCode, canonicalKey } for a variant or color field.
 * Handles objects, strings (name/UUID/hex), and metadata cache lookups.
 * Guaranteed to return human-readable color name and hexCode CSS string.
 */
export function getVariantColorInfo(v, catalogColors = []) {
  if (!v) return { id: '', name: '', hexCode: '#6B7280', canonicalKey: '' };

  let rawColor = v.color || v.colors || v.colorDetails || null;
  let colorId = v.colorId || v.color_id || '';
  let colorName = '';
  let hexCode = '';

  if (rawColor && typeof rawColor === 'object') {
    colorId = rawColor.id || colorId || '';
    colorName = rawColor.name || '';
    hexCode = rawColor.hex_code || rawColor.hexCode || '';
  } else if (typeof rawColor === 'string') {
    const trimmed = rawColor.trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      colorId = trimmed;
    } else if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
      hexCode = trimmed;
    } else {
      colorName = trimmed;
    }
  }

  // 1. If colorId is known, lookup in catalogColors
  if (colorId && Array.isArray(catalogColors) && catalogColors.length > 0) {
    const matched = catalogColors.find(c => c.id === colorId);
    if (matched) {
      if (!colorName || /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(colorName)) {
        colorName = matched.name;
      }
      if (!hexCode) {
        hexCode = matched.hex_code || matched.hexCode || '';
      }
    }
  }

  // 2. If colorName was mistakenly set to a HEX string (e.g., "#BE80DB"), resolve human name from catalog
  if (colorName && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(colorName.trim())) {
    if (!hexCode) hexCode = colorName.trim();
    if (Array.isArray(catalogColors) && catalogColors.length > 0) {
      const matched = catalogColors.find(c =>
        (c.hex_code || c.hexCode || '').toLowerCase() === colorName.trim().toLowerCase()
      );
      if (matched && matched.name) {
        colorName = matched.name;
      }
    }
  }

  // 3. If hexCode is known, but colorName is missing or still a HEX string, lookup name from catalog
  if ((!colorName || /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(colorName)) && hexCode && Array.isArray(catalogColors)) {
    const matched = catalogColors.find(c =>
      (c.hex_code || c.hexCode || '').toLowerCase() === hexCode.toLowerCase()
    );
    if (matched && matched.name) {
      colorName = matched.name;
      if (!colorId) colorId = matched.id;
    }
  }

  // 4. If colorName is known but hexCode is missing, lookup hex from catalog
  if (colorName && !hexCode && Array.isArray(catalogColors)) {
    const matched = catalogColors.find(c =>
      (c.name || '').toLowerCase() === colorName.toLowerCase()
    );
    if (matched) {
      hexCode = matched.hex_code || matched.hexCode || '';
      if (!colorId) colorId = matched.id;
    }
  }

  // Normalize HEX format: #RGB -> #RRGGBB
  if (hexCode && /^#[0-9a-fA-F]{3}$/.test(hexCode)) {
    hexCode = `#${hexCode[1]}${hexCode[1]}${hexCode[2]}${hexCode[2]}${hexCode[3]}${hexCode[3]}`;
  }

  // Fallback: If colorName is still a HEX string or empty, preserve valid display
  if (!colorName || /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(colorName)) {
    colorName = hexCode || (colorId ? 'Color' : 'Standard');
  }

  const canonicalKey = colorId ? String(colorId).trim().toLowerCase() : String(colorName).trim().toLowerCase();

  return {
    id: colorId || colorName,
    name: colorName,
    hexCode: hexCode || '#6B7280',
    canonicalKey
  };
}

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  const initialCached = useMemo(() => getMemoryCachedProduct(slug), [slug]);
  const [product, setProduct] = useState(initialCached);
  const [catalogColors, setCatalogColors] = useState([]);
  const [loading, setLoading] = useState(!initialCached);
  const [error, setError] = useState(null);

  // Variant selection keys (strictly ONE canonical key or empty string)
  const [selectedColorKey, setSelectedColorKey] = useState('');
  const [selectedSizeKey, setSelectedSizeKey] = useState('');
  const [selectedImage, setSelectedImage] = useState('');
  const [activeMobileIdx, setActiveMobileIdx] = useState(0);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  // Mobile carousel ref
  const mobileCarouselRef = useRef(null);

  // Commerce interaction states
  const [addedToCart, setAddedToCart] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);

  // Similar products state
  const [similarProducts, setSimilarProducts] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  // Canonical Variant Map: Group variants by color -> sizes -> exact existing variant
  const { colorOptions, colorSizeMap, hasColors, hasSizes } = React.useMemo(() => {
    if (!product?.variants || product.variants.length === 0) {
      return {
        colorOptions: [],
        colorSizeMap: new Map(),
        hasColors: false,
        hasSizes: false
      };
    }

    const colorMap = new Map(); // canonicalColorKey -> { color, sizesMap: Map<canonicalSizeKey, { id, name, canonicalKey, variant }> }
    let foundSizes = false;
    let foundColors = false;

    for (const v of product.variants) {
      const cInfo = getVariantColorInfo(v, catalogColors);
      const sInfo = getVariantSizeInfo(v);

      if (cInfo.name) foundColors = true;
      if (sInfo.name) foundSizes = true;

      const cKey = cInfo.canonicalKey || cInfo.name.toLowerCase();
      if (!cKey) continue;

      if (!colorMap.has(cKey)) {
        colorMap.set(cKey, {
          color: {
            id: cInfo.id,
            name: cInfo.name,
            hexCode: cInfo.hexCode,
            canonicalKey: cKey
          },
          sizesMap: new Map()
        });
      }

      const entry = colorMap.get(cKey);
      if ((!entry.color.hexCode || entry.color.hexCode === '#6B7280') && cInfo.hexCode && cInfo.hexCode !== '#6B7280') {
        entry.color.hexCode = cInfo.hexCode;
      }
      if (!entry.color.id && cInfo.id) {
        entry.color.id = cInfo.id;
      }

      if (sInfo.name) {
        const sKey = sInfo.canonicalKey || sInfo.name.toLowerCase();
        if (!entry.sizesMap.has(sKey)) {
          entry.sizesMap.set(sKey, {
            id: sInfo.id,
            name: sInfo.name,
            canonicalKey: sKey,
            variant: v
          });
        }
      }
    }

    const colorOptionsList = [];
    const finalColorSizeMap = new Map();

    for (const [colKey, entry] of colorMap.entries()) {
      colorOptionsList.push(entry.color);
      finalColorSizeMap.set(colKey, {
        color: entry.color,
        sizes: Array.from(entry.sizesMap.values())
      });
    }

    return {
      colorOptions: colorOptionsList,
      colorSizeMap: finalColorSizeMap,
      hasColors: colorOptionsList.length > 0 && foundColors,
      hasSizes: foundSizes
    };
  }, [product?.variants, catalogColors]);

  // Active selected color object from colorOptions (strictly ONE or null)
  const selectedColorObj = React.useMemo(() => {
    if (!colorOptions.length || !selectedColorKey) return null;
    const normKey = selectedColorKey.trim().toLowerCase();
    return colorOptions.find(
      c => c.canonicalKey === normKey || c.name.toLowerCase() === normKey || (c.id && c.id.toLowerCase() === normKey)
    ) || null;
  }, [colorOptions, selectedColorKey]);

  // Sizes available strictly for the selected color (or all sizes if no colors exist)
  const availableSizes = React.useMemo(() => {
    if (selectedColorObj) {
      const entry = colorSizeMap.get(selectedColorObj.canonicalKey);
      return entry ? entry.sizes : [];
    }

    // Fallback: If product has sizes but no colors
    if (colorOptions.length === 0 && product?.variants) {
      const seen = new Set();
      const list = [];
      for (const v of product.variants) {
        const sInfo = getVariantSizeInfo(v);
        if (sInfo.name) {
          const sKey = sInfo.canonicalKey || sInfo.name.toLowerCase();
          if (!seen.has(sKey)) {
            seen.add(sKey);
            list.push({ ...sInfo, variant: v });
          }
        }
      }
      return list;
    }

    return [];
  }, [selectedColorObj, colorOptions.length, product?.variants, colorSizeMap]);

  // Active selected size object from availableSizes (strictly ONE or null)
  const selectedSizeObj = React.useMemo(() => {
    if (!availableSizes.length || !selectedSizeKey) return null;
    const normKey = selectedSizeKey.trim().toLowerCase();
    return availableSizes.find(
      s => s.canonicalKey === normKey || s.name.toLowerCase() === normKey || (s.id && s.id.toLowerCase() === normKey)
    ) || null;
  }, [availableSizes, selectedSizeKey]);

  // Authoritative exact variant matching selectedColor + selectedSize
  const selectedVariant = React.useMemo(() => {
    if (selectedSizeObj && selectedSizeObj.variant) {
      return selectedSizeObj.variant;
    }

    // Single variant product (no color options and no size options)
    if (colorOptions.length === 0 && availableSizes.length === 0 && product?.variants?.length === 1) {
      return product.variants[0];
    }

    return null;
  }, [selectedSizeObj, colorOptions.length, availableSizes.length, product?.variants]);

  // Fetch product data on slug change & load catalog colors
  useEffect(() => {
    let isMounted = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveMobileIdx(0);
    const controller = new AbortController();

    const memoryProd = getMemoryCachedProduct(slug);
    if (memoryProd) {
      setProduct(memoryProd);
      setLoading(false);
      const primaryImg = memoryProd?.images?.find(img => img.is_primary) || memoryProd?.images?.[0];
      setSelectedImage(primaryImg ? primaryImg.imageUrl : (memoryProd?.thumbnailUrl || ''));
      if (memoryProd?.variants && memoryProd.variants.length > 0) {
        const firstVariant = memoryProd.variants[0];
        const firstColorInfo = getVariantColorInfo(firstVariant, catalogColors);
        const firstSizeInfo = getVariantSizeInfo(firstVariant);
        setSelectedColorKey(firstColorInfo.canonicalKey || firstColorInfo.name.toLowerCase());
        setSelectedSizeKey(firstSizeInfo.canonicalKey || firstSizeInfo.name.toLowerCase());
      }
    } else {
      setLoading(true);
    }

    async function loadProductDetail() {
      setError(null);
      try {
        const [productData, colorsData] = await Promise.all([
          getCachedProductDetail(slug, false, { signal: controller.signal }),
          getCachedColors().catch(() => [])
        ]);

        const resolvedColors = Array.isArray(colorsData) ? colorsData : [];
        if (!isMounted || controller.signal.aborted) return;

        setProduct(productData);
        if (resolvedColors.length > 0) {
          setCatalogColors(resolvedColors);
        }

        // Determine hero image
        const primaryImg = productData?.images?.find(img => img.is_primary) || productData?.images?.[0];
        setSelectedImage(primaryImg ? primaryImg.imageUrl : (productData?.thumbnailUrl || ''));

        // Initialize variants on product load (strictly one default color & size if available)
        if (productData?.variants && productData.variants.length > 0) {
          const firstVariant = productData.variants[0];
          const firstColorInfo = getVariantColorInfo(firstVariant, resolvedColors);
          const firstSizeInfo = getVariantSizeInfo(firstVariant);

          setSelectedColorKey(firstColorInfo.canonicalKey || firstColorInfo.name.toLowerCase());
          setSelectedSizeKey(firstSizeInfo.canonicalKey || firstSizeInfo.name.toLowerCase());
        } else {
          setSelectedColorKey('');
          setSelectedSizeKey('');
        }

        // Fetch similar products with abort signal
        fetchSimilarProducts(productData, controller.signal);
      } catch (err) {
        if (err.name === 'AbortError' || err.code === 20) return;
        console.error('Failed to load product detail:', err.message);
        if (isMounted && !memoryProd) {
          setError(err.message || 'Product not found');
        }
      } finally {
        if (isMounted && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    async function fetchSimilarProducts(currentProd, signal) {
      if (!currentProd || signal?.aborted) return;
      setSimilarLoading(true);
      try {
        const catSlug = currentProd.category?.slug || (typeof currentProd.category === 'string' ? currentProd.category : '');
        const queryUrl = catSlug ? `/products?category=${encodeURIComponent(catSlug)}&limit=5` : '/products?limit=5';
        const res = await api.get(queryUrl, { signal });
        const list = Array.isArray(res.data) ? res.data : (res.data?.products || []);

        // Exclude current product and take up to 4
        const filtered = list
          .filter(p => p.id !== currentProd.id && p.slug !== currentProd.slug)
          .slice(0, 4);

        if (isMounted && !signal?.aborted) {
          setSimilarProducts(filtered);
        }
      } catch (e) {
        if (e.name === 'AbortError' || e.code === 20) return;
        console.warn('Failed to load similar products:', e.message);
      } finally {
        if (isMounted && !signal?.aborted) {
          setSimilarLoading(false);
        }
      }
    }

    loadProductDetail();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [slug]);

  // Mobile carousel scroll listener to detect center image
  const handleMobileCarouselScroll = () => {
    if (!mobileCarouselRef.current) return;
    const container = mobileCarouselRef.current;
    const center = container.scrollLeft + container.offsetWidth / 2;
    const children = Array.from(container.children);
    let closestIdx = 0;
    let minDiff = Infinity;
    children.forEach((child, idx) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const diff = Math.abs(childCenter - center);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    if (closestIdx !== activeMobileIdx) {
      setActiveMobileIdx(closestIdx);
    }
  };

  const handleColorChange = useCallback((col) => {
    const targetKey = col.canonicalKey || col.id || col.name;
    const normTargetKey = String(targetKey).trim().toLowerCase();
    const targetOption = colorOptions.find(
      c => c.canonicalKey === normTargetKey || c.name.toLowerCase() === normTargetKey || (c.id && c.id.toLowerCase() === normTargetKey)
    );
    const resolvedKey = targetOption ? targetOption.canonicalKey : normTargetKey;
    setSelectedColorKey(resolvedKey);

    // Check if the current selectedSize exists for this new color
    const newColorEntry = colorSizeMap.get(resolvedKey);
    const newSizes = newColorEntry ? newColorEntry.sizes : [];

    const normCurrentSizeKey = (selectedSizeKey || '').trim().toLowerCase();
    const currentSizeStillValid = normCurrentSizeKey && newSizes.some(
      s => s.canonicalKey === normCurrentSizeKey || s.name.toLowerCase() === normCurrentSizeKey || (s.id && s.id.toLowerCase() === normCurrentSizeKey)
    );

    if (!currentSizeStillValid) {
      // Step 8: Clear size selection if current size does NOT exist for new color
      setSelectedSizeKey('');
    }
  }, [colorOptions, colorSizeMap, selectedSizeKey]);

  const handleSizeChange = useCallback((sizeOpt) => {
    const targetKey = sizeOpt.canonicalKey || sizeOpt.id || sizeOpt.name;
    setSelectedSizeKey(String(targetKey).trim().toLowerCase());
  }, []);

  const handleWishlistToggle = useCallback(async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!product) return;
    try {
      if (isInWishlist(product.id)) {
        await removeFromWishlist(product.id);
      } else {
        await addToWishlist(product.id, product);
      }
    } catch (err) {
      alert(err.message || 'Wishlist update failed');
    }
  }, [isAuthenticated, product, isInWishlist, removeFromWishlist, addToWishlist, navigate]);

  const handleAddToCart = useCallback(async () => {
    if (!selectedVariant) {
      if (hasColors && !selectedColorObj) {
        alert('Please select a color');
      } else if (hasSizes && !selectedSizeObj) {
        alert('Please select a size');
      } else {
        alert('Please select product options');
      }
      return;
    }
    try {
      setIsAddingToCart(true);
      await addToCart(selectedVariant.id, 1);
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2200);
    } catch (err) {
      alert(err.message || 'Failed to add item to cart');
    } finally {
      setIsAddingToCart(false);
    }
  }, [selectedVariant, hasColors, selectedColorObj, hasSizes, selectedSizeObj, addToCart]);

  const handleBuyNow = useCallback(async () => {
    if (!selectedVariant) {
      if (hasColors && !selectedColorObj) {
        alert('Please select a color');
      } else if (hasSizes && !selectedSizeObj) {
        alert('Please select a size');
      } else {
        alert('Please select product options');
      }
      return;
    }
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      setIsBuyingNow(true);
      await addToCart(selectedVariant.id, 1);
      navigate('/checkout');
    } catch (err) {
      alert(err.message || 'Failed to proceed to checkout');
    } finally {
      setIsBuyingNow(false);
    }
  }, [selectedVariant, hasColors, selectedColorObj, hasSizes, selectedSizeObj, isAuthenticated, addToCart, navigate]);

  if (loading && !product) {
    return (
      <BaseLayout>
        <div className="w-full max-w-5xl xl:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-5 pb-24 sm:pb-16 min-w-0 box-border animate-pulse">
          {/* Breadcrumb Skeleton */}
          <div className="flex items-center space-x-2 text-xs mb-2.5 sm:mb-4">
            <div className="h-3.5 bg-menx-surface-elevated rounded w-16" />
            <span className="text-menx-border">/</span>
            <div className="h-3.5 bg-menx-surface-elevated rounded w-24" />
            <span className="text-menx-border">/</span>
            <div className="h-3.5 bg-menx-surface-elevated rounded w-36" />
          </div>

          {/* Mobile Skeleton */}
          <div className="lg:hidden flex flex-col space-y-4 w-full">
            <div className="aspect-[4/5] rounded-2xl bg-menx-surface border border-menx-border/60 w-full" />
            <div className="space-y-2">
              <div className="h-3 bg-menx-surface-elevated rounded w-28" />
              <div className="h-6 bg-menx-surface-elevated rounded w-3/4" />
              <div className="h-7 bg-menx-surface-elevated rounded w-32" />
            </div>
          </div>

          {/* Desktop Skeleton */}
          <div className="hidden lg:grid grid-cols-12 gap-8 xl:gap-10 items-start max-w-5xl xl:max-w-6xl">
            <div className="col-span-5 flex flex-col space-y-3">
              <div className="w-full h-[380px] xl:h-[410px] bg-menx-surface border border-menx-border/60 rounded-2xl" />
              <div className="flex space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-16 h-16 bg-menx-surface rounded-xl border border-menx-border" />
                ))}
              </div>
            </div>
            <div className="col-span-7 space-y-5">
              <div className="space-y-2">
                <div className="h-3.5 bg-menx-surface-elevated rounded w-28" />
                <div className="h-7 bg-menx-surface-elevated rounded w-3/4" />
                <div className="h-4 bg-menx-surface-elevated rounded w-1/2" />
              </div>
              <div className="h-8 bg-menx-surface-elevated rounded w-36" />
              <div className="space-y-2 pt-4 border-t border-menx-border">
                <div className="h-4 bg-menx-surface-elevated rounded w-20" />
                <div className="flex space-x-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-menx-surface border border-menx-border" />
                  ))}
                </div>
              </div>
              <div className="space-y-2 pt-2">
                <div className="h-4 bg-menx-surface-elevated rounded w-20" />
                <div className="flex space-x-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="w-12 h-10 rounded-xl bg-menx-surface border border-menx-border" />
                  ))}
                </div>
              </div>
              <div className="h-12 bg-menx-surface-elevated rounded-xl w-full" />
            </div>
          </div>
        </div>
      </BaseLayout>
    );
  }

  if (error || !product) {
    return (
      <BaseLayout>
        <div className="max-w-md mx-auto my-20 p-8 bg-menx-surface border border-menx-border rounded-2xl text-center space-y-5 shadow-2xl">
          <ShieldAlert className="w-12 h-12 mx-auto text-menx-error" />
          <h2 className="text-xl font-bold tracking-tight text-white">Product Not Found</h2>
          <p className="text-sm text-menx-text-secondary leading-relaxed">
            The collection item you requested could not be retrieved. It may have been unpublished or removed.
          </p>
          <Link
            to="/"
            className="inline-flex items-center space-x-2 text-sm font-semibold text-menx-primary hover:text-menx-primary-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Catalog</span>
          </Link>
        </div>
      </BaseLayout>
    );
  }

  const priceInfo = getProductPrice(product, selectedVariant);
  const stockInfo = getVariantStock(selectedVariant);
  const isWishlisted = isInWishlist(product.id);

  // All valid gallery images
  const allImages = (product?.images && product.images.length > 0)
    ? product.images.map(img => img.imageUrl).filter(Boolean)
    : (product?.thumbnailUrl ? [product.thumbnailUrl] : []);

  const currentImgSrc = selectedImage || allImages[0] || '';
  const currentImgIdx = allImages.indexOf(currentImgSrc) >= 0 ? allImages.indexOf(currentImgSrc) : 0;

  const handlePrevImage = (e) => {
    e.stopPropagation();
    if (allImages.length <= 1) return;
    const nextIdx = (currentImgIdx - 1 + allImages.length) % allImages.length;
    setSelectedImage(allImages[nextIdx]);
  };

  const handleNextImage = (e) => {
    e.stopPropagation();
    if (allImages.length <= 1) return;
    const nextIdx = (currentImgIdx + 1) % allImages.length;
    setSelectedImage(allImages[nextIdx]);
  };

  const categoryName = getSafeLabel(product.category, 'Collection');
  const brandName = getSafeLabel(product.brand, '');
  const activeSku = selectedVariant?.sku || product?.sku || '';

  return (
    <BaseLayout>
      <div className="w-full max-w-5xl xl:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-5 pb-24 sm:pb-16 min-w-0 box-border">

        {/* 1. Subtle Breadcrumb & Back Navigation */}
        <div className="flex items-center space-x-2 text-xs text-menx-text-muted mb-2.5 sm:mb-4 min-w-0 w-full overflow-hidden">
          <Link
            to="/"
            className="inline-flex items-center space-x-1.5 text-menx-text-secondary hover:text-menx-primary transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </Link>
          <span className="text-menx-border shrink-0">/</span>
          <span className="text-menx-text-muted truncate min-w-0 max-w-[120px] sm:max-w-none">{categoryName}</span>
          <span className="text-menx-border hidden sm:inline shrink-0">/</span>
          <span className="text-menx-text-secondary truncate min-w-0 max-w-[180px] hidden sm:inline">{product.title}</span>
        </div>

        {/* ======================================================== */}
        {/* MOBILE VIEW (lg:hidden) — FULL-BLEED GALLERY & REFINED TITLE */}
        {/* ======================================================== */}
        <div className="lg:hidden flex flex-col space-y-3.5 w-full min-w-0">
          {/* Mobile Horizontal Peek Carousel (Zero Inner Padding, Constrained Width) */}
          <div className="relative -mx-4 sm:mx-0 w-[calc(100%+2rem)] sm:w-full max-w-[100vw] overflow-hidden">
            <div
              ref={mobileCarouselRef}
              onScroll={handleMobileCarouselScroll}
              className={`flex overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-none py-1 w-full ${
                allImages.length > 1 ? 'px-4 sm:px-6 gap-3' : 'px-4'
              }`}
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {allImages.map((imgUrl, idx) => (
                <div
                  key={idx}
                  className={`shrink-0 snap-center aspect-[4/5] rounded-2xl overflow-hidden bg-menx-surface border border-menx-border/60 relative shadow-xl ${
                    allImages.length > 1 ? 'w-[80vw] sm:w-[75vw] max-w-[360px]' : 'w-full'
                  }`}
                >
                  <img
                    src={imgUrl}
                    alt={`${product.title} view ${idx + 1}`}
                    loading={idx === 0 ? "eager" : "lazy"}
                    fetchPriority={idx === 0 ? "high" : "low"}
                    decoding={idx === 0 ? "sync" : "async"}
                    className="w-full h-full object-cover select-none"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`;
                    }}
                  />

                  {/* Wishlist Button */}
                  <button
                    type="button"
                    onClick={handleWishlistToggle}
                    aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                    className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-[#0B0F14]/70 hover:bg-[#0B0F14]/90 backdrop-blur-md border border-menx-border/80 flex items-center justify-center transition-all duration-200 active:scale-90 shadow-md cursor-pointer"
                  >
                    <Heart
                      className={`w-4.5 h-4.5 transition-colors duration-200 ${
                        isWishlisted ? 'text-menx-primary fill-menx-primary' : 'text-menx-text-secondary'
                      }`}
                    />
                  </button>

                  {/* Image Counter Badge */}
                  {allImages.length > 1 && (
                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md bg-[#0B0F14]/75 backdrop-blur-md border border-menx-border/60 text-[11px] font-mono font-medium text-menx-text-secondary shadow-sm">
                      {idx + 1} / {allImages.length}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Refined Mobile Product Identity Section (Cohesive Compact Rhythm) */}
          <div className="space-y-1.5 pt-0.5 w-full min-w-0">
            {/* Category & Brand Micro-Header */}
            <div className="flex items-center justify-between text-xs tracking-wider font-mono uppercase text-menx-text-muted min-w-0">
              <span className="text-menx-primary font-semibold truncate">{categoryName}</span>
              {brandName && <span className="text-menx-text-secondary font-medium truncate ml-2">{brandName}</span>}
            </div>

            {/* Mobile Product Title — Clean & Responsive Typography */}
            <h1 className="text-[20px] sm:text-[22px] font-semibold text-menx-text tracking-normal leading-[1.25] break-words">
              {product.title}
            </h1>

            {/* Price Section (Compact & Visually Connected) */}
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 pt-0.5 min-w-0">
              <span className="text-2xl font-bold text-menx-text font-mono tracking-tight whitespace-nowrap">
                {formatCurrency(priceInfo.sellingPrice)}
              </span>

              {priceInfo.hasDiscount && (
                <>
                  <span className="text-sm text-menx-text-muted line-through font-mono whitespace-nowrap">
                    {formatCurrency(priceInfo.mrp)}
                  </span>
                  <span className="px-1.5 py-0.5 text-[11px] font-bold font-mono text-menx-primary bg-menx-primary/10 border border-menx-primary/30 rounded-md whitespace-nowrap">
                    {priceInfo.discountPercent}% OFF
                  </span>
                </>
              )}
            </div>

            {/* SKU (Subtle) */}
            {activeSku && (
              <div className="text-xs font-mono text-menx-text-muted pt-0.5 truncate">
                SKU: <span className="text-menx-text-secondary">{activeSku}</span>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* DESKTOP VIEW (hidden lg:grid) — FIXED COMPACT GALLERY & CARD */}
        {/* ======================================================== */}
        <div className="hidden lg:grid grid-cols-12 gap-8 xl:gap-10 items-start max-w-5xl xl:max-w-6xl">

          {/* LEFT COLUMN: Fixed Compact Gallery */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col space-y-2.5 w-full max-w-[340px] xl:max-w-[370px]">
            {/* Main Hero Image Stage (Fixed Compact Size) */}
            <div className="relative w-full h-[380px] xl:h-[410px] bg-menx-surface border border-menx-border/60 rounded-2xl overflow-hidden flex items-center justify-center group shadow-xl">
              {currentImgSrc ? (
                <img
                  src={currentImgSrc}
                  alt={product.title}
                  loading="eager"
                  fetchPriority="high"
                  decoding="sync"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 select-none"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`;
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-menx-text-muted space-y-2">
                  <ShoppingBag className="w-12 h-12 opacity-30" />
                  <span className="text-xs uppercase font-mono tracking-wider">Image Unavailable</span>
                </div>
              )}

              {/* Wishlist Button (Hero Top-Right) */}
              <button
                type="button"
                onClick={handleWishlistToggle}
                aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-[#0B0F14]/70 hover:bg-[#0B0F14]/90 backdrop-blur-md border border-menx-border/80 flex items-center justify-center transition-all duration-200 active:scale-90 shadow-md cursor-pointer"
              >
                <Heart
                  className={`w-4 h-4 transition-colors duration-200 ${
                    isWishlisted ? 'text-menx-primary fill-menx-primary' : 'text-menx-text-secondary hover:text-white'
                  }`}
                />
              </button>

              {/* Previous / Next Arrow Controls */}
              {allImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    aria-label="Previous image"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#0B0F14]/70 hover:bg-[#0B0F14]/90 backdrop-blur-md border border-menx-border/80 flex items-center justify-center text-menx-text-secondary hover:text-white transition-all duration-200 opacity-0 group-hover:opacity-100 active:scale-90 shadow-md cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    aria-label="Next image"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#0B0F14]/70 hover:bg-[#0B0F14]/90 backdrop-blur-md border border-menx-border/80 flex items-center justify-center text-menx-text-secondary hover:text-white transition-all duration-200 opacity-0 group-hover:opacity-100 active:scale-90 shadow-md cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* Image Counter Badge */}
              {allImages.length > 1 && (
                <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-[#0B0F14]/75 backdrop-blur-md border border-menx-border/60 text-[10px] font-mono font-medium text-menx-text-secondary shadow-sm">
                  {currentImgIdx + 1} / {allImages.length}
                </div>
              )}
            </div>

            {/* Compact Thumbnail Strip */}
            {allImages.length > 1 && (
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
                {allImages.map((imgUrl, idx) => {
                  const isSelected = imgUrl === currentImgSrc;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImage(imgUrl)}
                      className={`relative w-12 h-12 xl:w-13 xl:h-13 rounded-xl overflow-hidden bg-menx-surface border-2 shrink-0 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'border-menx-primary shadow-md shadow-menx-primary/10 scale-100'
                          : 'border-menx-border/70 hover:border-menx-text-muted/60 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={imgUrl}
                        alt={`${product.title} thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Compact Desktop Info (7 cols on xl, 7 cols on lg) */}
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col space-y-3 xl:space-y-3.5">
            {/* Title & Brand */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] tracking-widest font-mono uppercase text-menx-text-muted">
                <span className="text-menx-primary font-bold">{categoryName}</span>
                {brandName && <span className="text-menx-text-secondary font-medium">{brandName}</span>}
              </div>

              <h1 className="text-2xl xl:text-3xl font-extrabold text-menx-text tracking-tight leading-tight">
                {product.title}
              </h1>
            </div>

            {/* Rating */}
            {product.rating && (
              <div className="flex items-center space-x-2 text-xs text-menx-text-secondary">
                <div className="flex items-center text-menx-primary">
                  <Sparkles className="w-3.5 h-3.5 mr-1 fill-menx-primary" />
                  <span className="font-bold font-mono">{product.rating}</span>
                </div>
                {product.reviewCount && (
                  <>
                    <span className="text-menx-border">•</span>
                    <span className="text-menx-text-muted">({product.reviewCount} reviews)</span>
                  </>
                )}
              </div>
            )}

            {/* Price & SKU Block */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 pt-0.5">
                <span className="text-2xl xl:text-3xl font-black text-menx-text font-mono tracking-tight">
                  {formatCurrency(priceInfo.sellingPrice)}
                </span>

                {priceInfo.hasDiscount && (
                  <>
                    <span className="text-sm xl:text-base text-menx-text-muted line-through font-mono">
                      {formatCurrency(priceInfo.mrp)}
                    </span>
                    <span className="px-1.5 py-0.5 text-[11px] font-bold font-mono text-menx-primary bg-menx-primary/10 border border-menx-primary/30 rounded-md">
                      {priceInfo.discountPercent}% OFF
                    </span>
                  </>
                )}
              </div>

              {activeSku && (
                <div className="text-[11px] font-mono text-menx-text-muted">
                  SKU: <span className="text-menx-text-secondary font-mono">{activeSku}</span>
                </div>
              )}
            </div>

            <div className="border-t border-menx-border/40" />

            {/* Color Selection */}
            {hasColors && colorOptions.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-menx-text-muted">Color</span>
                  {selectedColorObj ? (
                    <div className="flex items-center space-x-1.5 font-semibold text-menx-text-secondary">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block shrink-0 border border-white/20 shadow-sm"
                        style={{ backgroundColor: selectedColorObj.hexCode || '#6B7280' }}
                        aria-hidden="true"
                      />
                      <span>{selectedColorObj.name}</span>
                    </div>
                  ) : (
                    <span className="font-semibold text-menx-text-secondary">Select a color</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Product Color Options">
                  {colorOptions.map((col) => {
                    const isSelected = Boolean(
                      selectedColorObj && selectedColorObj.canonicalKey === col.canonicalKey
                    );
                    return (
                      <button
                        key={col.canonicalKey}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={`Select color ${col.name}`}
                        onClick={() => handleColorChange(col)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 min-h-[34px] text-xs font-semibold rounded-xl border transition-all duration-200 cursor-pointer select-none ${
                          isSelected
                            ? 'bg-menx-primary/15 border-menx-primary text-white shadow-sm shadow-menx-primary/10 ring-1 ring-menx-primary/40'
                            : 'bg-menx-surface border-menx-border/80 text-menx-text-secondary hover:border-menx-text-muted hover:text-white hover:bg-menx-surface-elevated'
                        }`}
                      >
                        {/* Visual CSS Swatch */}
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/30 shadow-sm relative flex items-center justify-center"
                          style={{ backgroundColor: col.hexCode || '#6B7280' }}
                        >
                          <span className="absolute inset-0 rounded-full border border-white/20 pointer-events-none" />
                        </span>

                        {/* Human Readable Color Name */}
                        <span className="truncate max-w-[140px]">{col.name}</span>

                        {/* Selected Checkmark */}
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-menx-primary shrink-0 ml-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selection */}
            {hasSizes && availableSizes.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-menx-text-muted">Size</span>
                  <span className="font-semibold text-menx-text-secondary">{selectedSizeObj?.name || 'Select a size'}</span>
                </div>

                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Product Size Options">
                  {availableSizes.map((sizeOpt) => {
                    const isSelected = Boolean(
                      selectedSizeObj && selectedSizeObj.canonicalKey === sizeOpt.canonicalKey
                    );
                    const sizeStock = getVariantStock(sizeOpt.variant);
                    const isOutOfStock = sizeStock.isOutOfStock;

                    return (
                      <button
                        key={sizeOpt.canonicalKey}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={`Select size ${sizeOpt.name}`}
                        disabled={isOutOfStock}
                        onClick={() => handleSizeChange(sizeOpt)}
                        className={`min-w-[40px] px-3 py-1.5 text-xs font-bold rounded-xl border transition-all duration-200 cursor-pointer ${
                          isOutOfStock
                            ? 'bg-menx-surface/40 border-menx-border/30 text-menx-text-muted/40 cursor-not-allowed line-through'
                            : isSelected
                            ? 'bg-menx-primary/15 border-menx-primary text-menx-primary shadow-sm shadow-menx-primary/10 ring-1 ring-menx-primary/40'
                            : 'bg-menx-surface border-menx-border/80 text-menx-text-secondary hover:border-menx-text-muted hover:text-white'
                        }`}
                      >
                        {sizeOpt.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Availability */}
            {selectedVariant && stockInfo && (
              <div className="flex items-center space-x-2 text-xs pt-0.5">
                <span className="text-menx-text-muted font-medium">Availability:</span>
                <span className={`font-mono font-bold px-2 py-0.5 rounded-md border text-[11px] ${
                  stockInfo.inStock && !stockInfo.isLowStock
                    ? 'bg-menx-success/10 border-menx-success/30 text-menx-success'
                    : stockInfo.isLowStock
                    ? 'bg-menx-warning/10 border-menx-warning/30 text-menx-warning'
                    : 'bg-menx-error/10 border-menx-error/30 text-menx-error'
                }`}>
                  {stockInfo.label.toUpperCase()}
                </span>
              </div>
            )}

            {/* Actions & Benefits Block */}
            <div className="pt-1 space-y-2.5">
              <div className="flex flex-row gap-2.5">
                <button
                  type="button"
                  disabled={!selectedVariant || stockInfo?.isOutOfStock || addedToCart || isAddingToCart || isBuyingNow}
                  onClick={handleAddToCart}
                  className={`flex-1 py-3 px-4 font-extrabold rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 text-xs xl:text-sm shadow-sm ${
                    addedToCart
                      ? 'bg-menx-success text-white shadow-menx-success/20'
                      : isAddingToCart
                      ? 'bg-menx-primary/80 cursor-wait text-[#0B0F14]'
                      : !selectedVariant || stockInfo?.isOutOfStock
                      ? 'bg-menx-surface text-menx-text-muted border border-menx-border/60 cursor-not-allowed'
                      : 'border border-menx-primary text-menx-primary bg-menx-primary/10 hover:bg-menx-primary/20 active:scale-98 cursor-pointer'
                  }`}
                >
                  {isAddingToCart ? (
                    <>
                      <div className="w-4 h-4 border-2 border-menx-primary border-t-transparent rounded-full animate-spin" />
                      <span>Adding...</span>
                    </>
                  ) : addedToCart ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Added to Cart!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>
                        {!selectedVariant
                          ? (hasSizes && !selectedSizeObj ? 'Select Size' : 'Select Options')
                          : stockInfo?.isOutOfStock
                          ? 'Out of Stock'
                          : 'Add to Cart'}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={!selectedVariant || stockInfo?.isOutOfStock || isBuyingNow || isAddingToCart}
                  onClick={handleBuyNow}
                  className={`flex-1 py-3 px-4 font-extrabold rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 text-xs xl:text-sm shadow-md ${
                    !selectedVariant || stockInfo?.isOutOfStock
                      ? 'bg-menx-surface text-menx-text-muted border border-menx-border/60 cursor-not-allowed shadow-none'
                      : 'bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] shadow-menx-primary/20 active:scale-98 cursor-pointer'
                  }`}
                >
                  {isBuyingNow ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#0B0F14] border-t-transparent rounded-full animate-spin" />
                      <span>Proceeding...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-[#0B0F14] fill-[#0B0F14]" />
                      <span>Buy Now</span>
                    </>
                  )}
                </button>
              </div>

              {/* Compact Benefits Row (No wrapping / no overflow) */}
              <div className="grid grid-cols-3 gap-2 pt-0.5 text-[11px] text-menx-text-muted">
                <div className="flex items-center justify-center space-x-1.5 p-2 rounded-xl menx-card text-center min-w-0">
                  <Truck className="w-3.5 h-3.5 text-menx-primary shrink-0" />
                  <span className="text-[10px] xl:text-[11px] font-medium text-menx-text-secondary truncate">Free Express Delivery</span>
                </div>
                <div className="flex items-center justify-center space-x-1.5 p-2 rounded-xl menx-card text-center min-w-0">
                  <RotateCcw className="w-3.5 h-3.5 text-menx-primary shrink-0" />
                  <span className="text-[10px] xl:text-[11px] font-medium text-menx-text-secondary truncate">7-Day Easy Returns</span>
                </div>
                <div className="flex items-center justify-center space-x-1.5 p-2 rounded-xl menx-card text-center min-w-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-menx-primary shrink-0" />
                  <span className="text-[10px] xl:text-[11px] font-medium text-menx-text-secondary truncate">100% Authentic</span>
                </div>
              </div>
            </div>

            <div className="border-t border-menx-border/40" />

            {/* Description */}
            {product.description && (
              <div className="space-y-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-menx-text-muted">
                  Description
                </h3>
                <div className="text-xs xl:text-sm text-menx-text-secondary leading-relaxed">
                  <p className={!isDescExpanded && product.description.length > 180 ? 'line-clamp-2 xl:line-clamp-3' : ''}>
                    {product.description}
                  </p>
                  {product.description.length > 180 && (
                    <button
                      type="button"
                      onClick={() => setIsDescExpanded(!isDescExpanded)}
                      className="text-xs font-bold text-menx-primary hover:text-menx-primary-hover mt-1 inline-flex items-center space-x-1 cursor-pointer transition-colors"
                    >
                      <span>{isDescExpanded ? 'Show less' : 'Read more'}</span>
                      {isDescExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* ======================================================== */}
        {/* MOBILE REST OF PAGE (lg:hidden) */}
        {/* ======================================================== */}
        <div className="lg:hidden flex flex-col space-y-4 pt-2 w-full min-w-0">
          <div className="border-t border-menx-border/40" />

          {/* Color Selection */}
          {hasColors && colorOptions.length > 0 && (
            <div className="space-y-2 w-full min-w-0">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-menx-text-muted">Color</span>
                {selectedColorObj ? (
                  <div className="flex items-center space-x-1.5 font-semibold text-menx-text-secondary truncate ml-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block shrink-0 border border-white/20 shadow-sm"
                      style={{ backgroundColor: selectedColorObj.hexCode || '#6B7280' }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{selectedColorObj.name}</span>
                  </div>
                ) : (
                  <span className="font-semibold text-menx-text-secondary truncate ml-2">Select a color</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 w-full" role="radiogroup" aria-label="Product Color Options">
                {colorOptions.map((col) => {
                  const isSelected = Boolean(
                    selectedColorObj && selectedColorObj.canonicalKey === col.canonicalKey
                  );
                  return (
                    <button
                      key={col.canonicalKey}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`Select color ${col.name}`}
                      onClick={() => handleColorChange(col)}
                      className={`inline-flex items-center gap-2 px-3 py-2 min-h-[40px] text-xs font-semibold rounded-xl border transition-all duration-200 cursor-pointer select-none max-w-full ${
                        isSelected
                          ? 'bg-menx-primary/15 border-menx-primary text-white shadow-sm shadow-menx-primary/10 ring-1 ring-menx-primary/40'
                          : 'bg-menx-surface border-menx-border/80 text-menx-text-secondary hover:border-menx-text-muted hover:text-white hover:bg-menx-surface-elevated'
                      }`}
                    >
                      {/* Visual CSS Swatch */}
                      <span
                        className="w-4 h-4 rounded-full shrink-0 border border-black/30 shadow-sm relative flex items-center justify-center"
                        style={{ backgroundColor: col.hexCode || '#6B7280' }}
                      >
                        <span className="absolute inset-0 rounded-full border border-white/20 pointer-events-none" />
                      </span>

                      {/* Human Readable Color Name */}
                      <span className="truncate max-w-[130px] sm:max-w-[180px]">{col.name}</span>

                      {/* Selected Checkmark */}
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-menx-primary shrink-0 ml-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size Selection */}
          {hasSizes && availableSizes.length > 0 && (
            <div className="space-y-2 w-full min-w-0">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-menx-text-muted">Size</span>
                <span className="font-semibold text-menx-text-secondary truncate ml-2">{selectedSizeObj?.name || 'Select a size'}</span>
              </div>

              <div className="flex flex-wrap gap-2 w-full" role="radiogroup" aria-label="Product Size Options">
                {availableSizes.map((sizeOpt) => {
                  const isSelected = Boolean(
                    selectedSizeObj && selectedSizeObj.canonicalKey === sizeOpt.canonicalKey
                  );
                  const sizeStock = getVariantStock(sizeOpt.variant);
                  const isOutOfStock = sizeStock.isOutOfStock;

                  return (
                    <button
                      key={sizeOpt.canonicalKey}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`Select size ${sizeOpt.name}`}
                      disabled={isOutOfStock}
                      onClick={() => handleSizeChange(sizeOpt)}
                      className={`min-w-[40px] px-3 py-1.5 text-xs font-bold rounded-xl border transition-all duration-200 cursor-pointer ${
                        isOutOfStock
                          ? 'bg-menx-surface/40 border-menx-border/30 text-menx-text-muted/40 cursor-not-allowed line-through'
                          : isSelected
                          ? 'bg-menx-primary/15 border-menx-primary text-menx-primary shadow-sm shadow-menx-primary/10 ring-1 ring-menx-primary/40'
                          : 'bg-menx-surface border-menx-border/80 text-menx-text-secondary hover:border-menx-text-muted hover:text-white'
                      }`}
                    >
                      {sizeOpt.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Availability */}
          {selectedVariant && stockInfo && (
            <div className="flex flex-wrap items-center gap-2 text-xs w-full min-w-0">
              <span className="text-menx-text-muted font-medium shrink-0">Availability:</span>
              <span className={`font-mono font-bold px-2 py-0.5 rounded-md border text-[11px] break-all ${
                stockInfo.inStock && !stockInfo.isLowStock
                  ? 'bg-menx-success/10 border-menx-success/30 text-menx-success'
                  : stockInfo.isLowStock
                  ? 'bg-menx-warning/10 border-menx-warning/30 text-menx-warning'
                  : 'bg-menx-error/10 border-menx-error/30 text-menx-error'
              }`}>
                {stockInfo.label.toUpperCase()}
              </span>
            </div>
          )}

          {/* Purchase Action Buttons */}
          <div className="pt-1 space-y-3 w-full min-w-0">
            <div className="flex flex-row gap-2.5 w-full min-w-0">
              <button
                type="button"
                disabled={!selectedVariant || stockInfo?.isOutOfStock || addedToCart || isAddingToCart || isBuyingNow}
                onClick={handleAddToCart}
                className={`flex-1 min-w-0 py-3 px-3 sm:px-4 font-extrabold rounded-xl transition-all duration-200 flex items-center justify-center space-x-1.5 text-xs sm:text-sm shadow-sm ${
                  addedToCart
                    ? 'bg-menx-success text-white shadow-menx-success/20'
                    : isAddingToCart
                    ? 'bg-menx-primary/80 cursor-wait text-[#0B0F14]'
                    : !selectedVariant || stockInfo?.isOutOfStock
                    ? 'bg-menx-surface text-menx-text-muted border border-menx-border/60 cursor-not-allowed'
                    : 'border border-menx-primary text-menx-primary bg-menx-primary/10 hover:bg-menx-primary/20 active:scale-98 cursor-pointer'
                }`}
              >
                {isAddingToCart ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-menx-primary border-t-transparent rounded-full animate-spin shrink-0" />
                    <span className="truncate">Adding...</span>
                  </>
                ) : addedToCart ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span className="truncate">Added!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {!selectedVariant
                        ? (hasSizes && !selectedSizeObj ? 'Select Size' : 'Select Options')
                        : stockInfo?.isOutOfStock
                        ? 'Out of Stock'
                        : 'Add to Cart'}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={!selectedVariant || stockInfo?.isOutOfStock || isBuyingNow || isAddingToCart}
                onClick={handleBuyNow}
                className={`flex-1 min-w-0 py-3 px-3 sm:px-4 font-extrabold rounded-xl transition-all duration-200 flex items-center justify-center space-x-1.5 text-xs sm:text-sm shadow-lg ${
                  !selectedVariant || stockInfo?.isOutOfStock
                    ? 'bg-menx-surface text-menx-text-muted border border-menx-border/60 cursor-not-allowed shadow-none'
                    : 'bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] shadow-menx-primary/20 active:scale-98 cursor-pointer'
                }`}
              >
                {isBuyingNow ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#0B0F14] border-t-transparent rounded-full animate-spin shrink-0" />
                    <span className="truncate">Proceeding...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-[#0B0F14] fill-[#0B0F14]" />
                    <span className="truncate">Buy Now</span>
                  </>
                )}
              </button>
            </div>

            {/* Benefits Section: 3 Compact Equal Columns with icon on top, wrapping text across 2 lines */}
            <div className="grid grid-cols-3 gap-2 pt-1 w-full min-w-0">
              <div className="flex flex-col items-center justify-center p-2 rounded-xl menx-card text-center min-w-0">
                <Truck className="w-4 h-4 text-menx-primary shrink-0 mb-1" />
                <span className="text-[10px] leading-tight text-menx-text-secondary font-medium">
                  Express<br />Delivery
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 rounded-xl menx-card text-center min-w-0">
                <RotateCcw className="w-4 h-4 text-menx-primary shrink-0 mb-1" />
                <span className="text-[10px] leading-tight text-menx-text-secondary font-medium">
                  7-Day<br />Returns
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 rounded-xl menx-card text-center min-w-0">
                <ShieldCheck className="w-4 h-4 text-menx-primary shrink-0 mb-1" />
                <span className="text-[10px] leading-tight text-menx-text-secondary font-medium">
                  100%<br />Authentic
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-menx-border/40" />

          {/* Description */}
          {product.description && (
            <div className="space-y-2 w-full min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-menx-text-muted">
                Description
              </h3>
              <div className="text-xs sm:text-sm text-menx-text-secondary leading-relaxed break-words">
                <p className={!isDescExpanded && product.description.length > 200 ? 'line-clamp-3' : ''}>
                  {product.description}
                </p>
                {product.description.length > 200 && (
                  <button
                    type="button"
                    onClick={() => setIsDescExpanded(!isDescExpanded)}
                    className="text-xs font-bold text-menx-primary hover:text-menx-primary-hover mt-1.5 inline-flex items-center space-x-1 cursor-pointer transition-colors"
                  >
                    <span>{isDescExpanded ? 'Show less' : 'Read more'}</span>
                    {isDescExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. SIMILAR PRODUCTS SECTION ("YOU MAY ALSO LIKE") */}
        {similarProducts.length > 0 && (
          <div className="mt-12 sm:mt-24 pt-8 sm:pt-12 border-t border-menx-border/50 w-full min-w-0">
            <div className="flex items-center justify-between mb-4 sm:mb-8">
              <div>
                <span className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-widest text-menx-primary">
                  Curated For You
                </span>
                <h2 className="text-lg sm:text-2xl font-extrabold text-menx-text tracking-tight mt-0.5">
                  YOU MAY ALSO LIKE
                </h2>
              </div>
            </div>

            {/* Desktop: 4 Columns, Tablet: 3-4 Columns, Mobile: 2 Columns */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 w-full min-w-0">
              {similarProducts.map((item) => {
                const itemPrice = getProductPrice(item);
                const itemWishlisted = isInWishlist(item.id);

                return (
                  <Link
                    key={item.id}
                    to={`/products/${item.slug}`}
                    className="group menx-card-interactive rounded-2xl overflow-hidden shadow-sm hover:shadow-xl flex flex-col relative min-w-0"
                  >
                    {/* Thumbnail Image Stage (Zero padding inside image) */}
                    <div className="aspect-square bg-[#0B0F14]/60 border-b border-menx-border/40 flex items-center justify-center relative overflow-hidden">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`;
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center text-menx-text-muted">
                          <ShoppingBag className="w-8 h-8 opacity-30" />
                        </div>
                      )}

                      {/* Wishlist Icon */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!isAuthenticated) {
                            navigate('/login');
                            return;
                          }
                          if (itemWishlisted) {
                            removeFromWishlist(item.id);
                          } else {
                            addToWishlist(item.id);
                          }
                        }}
                        aria-label="Toggle wishlist"
                        className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-[#0B0F14]/70 hover:bg-[#0B0F14]/90 backdrop-blur-md border border-menx-border/80 flex items-center justify-center transition-all duration-200 active:scale-90 shadow-sm cursor-pointer"
                      >
                        <Heart
                          className={`w-4 h-4 ${
                            itemWishlisted ? 'text-menx-primary fill-menx-primary' : 'text-menx-text-secondary hover:text-white'
                          }`}
                        />
                      </button>

                      {/* Discount Tag */}
                      {itemPrice.hasDiscount && (
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-menx-primary/15 border border-menx-primary/40 text-[10px] font-mono font-bold text-menx-primary backdrop-blur-sm">
                          {itemPrice.discountPercent}% OFF
                        </div>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between space-y-2 min-w-0">
                      <div className="min-w-0">
                        {item.brand && (
                          <div className="text-[10px] font-mono uppercase tracking-wider text-menx-text-muted truncate">
                            {getSafeLabel(item.brand)}
                          </div>
                        )}
                        <h3 className="text-xs sm:text-sm font-bold text-menx-text group-hover:text-menx-primary transition-colors line-clamp-1 mt-0.5 break-words">
                          {item.title}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-1 min-w-0">
                        <span className="text-sm sm:text-base font-black text-menx-text font-mono whitespace-nowrap">
                          {formatCurrency(itemPrice.sellingPrice)}
                        </span>
                        {itemPrice.hasDiscount && (
                          <span className="text-xs text-menx-text-muted line-through font-mono whitespace-nowrap">
                            {formatCurrency(itemPrice.mrp)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* 4. Mobile Sticky Bottom Purchase Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 w-full z-40 bg-menx-surface/95 backdrop-blur-md border-t border-menx-border px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] shadow-2xl box-border">
        <div className="flex items-center justify-between gap-2.5 w-full max-w-md mx-auto min-w-0">
          <div className="flex flex-col shrink-0 min-w-0 pr-1">
            <span className="text-[10px] text-menx-text-muted uppercase tracking-wider font-mono font-medium">Price</span>
            <span className="text-sm font-black text-menx-primary font-mono tracking-tight whitespace-nowrap">
              {formatCurrency(priceInfo.sellingPrice)}
            </span>
          </div>

          <div className="flex flex-1 gap-2 min-w-0">
            <button
              type="button"
              disabled={!selectedVariant || stockInfo?.isOutOfStock || addedToCart || isAddingToCart || isBuyingNow}
              onClick={handleAddToCart}
              className={`flex-1 min-w-0 py-2 px-2 font-extrabold rounded-xl text-xs flex items-center justify-center space-x-1 transition-all ${
                addedToCart
                  ? 'bg-menx-success text-white'
                  : !selectedVariant || stockInfo?.isOutOfStock
                  ? 'bg-menx-surface text-menx-text-muted border border-menx-border/60 cursor-not-allowed'
                  : 'border border-menx-primary text-menx-primary bg-menx-primary/10 active:scale-95'
              }`}
            >
              {addedToCart ? <Check className="w-3.5 h-3.5 shrink-0" /> : <ShoppingBag className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">{addedToCart ? 'Added' : !selectedVariant ? (hasSizes && !selectedSizeObj ? 'Size' : 'Cart') : 'Cart'}</span>
            </button>

            <button
              type="button"
              disabled={!selectedVariant || stockInfo?.isOutOfStock || isBuyingNow || isAddingToCart}
              onClick={handleBuyNow}
              className={`flex-1 min-w-0 py-2 px-2 font-extrabold rounded-xl text-xs flex items-center justify-center space-x-1 transition-all ${
                !selectedVariant || stockInfo?.isOutOfStock
                  ? 'bg-menx-surface text-menx-text-muted border border-menx-border/60 cursor-not-allowed'
                  : 'bg-menx-primary text-[#0B0F14] active:scale-95 shadow-md shadow-menx-primary/20'
              }`}
            >
              <Zap className="w-3.5 h-3.5 fill-[#0B0F14] shrink-0" />
              <span className="truncate">Buy Now</span>
            </button>
          </div>
        </div>
      </div>
    </BaseLayout>
  );
}
