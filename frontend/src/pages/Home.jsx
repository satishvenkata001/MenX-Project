import React, { useEffect, useState } from 'react';
import { api } from '../utils/api.js';
import { getCatalogMetadata } from '../utils/metadataCache.js';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ShoppingBag, ArrowRight, Heart, Search, SlidersHorizontal, Check, ChevronRight, X, ChevronLeft } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';
import CategorySlider from '../components/CategorySlider.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { formatCurrency, getProductPrice, getSafeLabel } from '../utils/formatters.js';
import { getFilterSizes } from '../utils/categorySizes.js';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [sizes, setSizes] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search, Filter & Sort states
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedFit, setSelectedFit] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Customer-facing sanitized, category-aware filter options
  const displaySizes = React.useMemo(() => {
    return getFilterSizes(selectedCategory, sizes, selectedSubcategory);
  }, [selectedCategory, selectedSubcategory, sizes]);

  // Active request sequence counter to discard obsolete in-flight responses
  const activeRequestId = React.useRef(0);

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Mobile Drawers Toggle States
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [drawerActiveCategory, setDrawerActiveCategory] = useState(null); // Selected main category in categories drawer

  // Temporary drawer states for Filter Drawer (Apply/Clear logic)
  const [tempBrand, setTempBrand] = useState('');
  const [tempSize, setTempSize] = useState('');
  const [tempFit, setTempFit] = useState('');
  const [tempMinPrice, setTempMinPrice] = useState('');
  const [tempMaxPrice, setTempMaxPrice] = useState('');
  const [tempSortBy, setTempSortBy] = useState('newest');
  
  const navigate = useNavigate();
  const location = useLocation();

  // Sync category filter from URL search params (e.g. from footer links or header navigation)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cat = params.get('category');
    if (cat !== null) {
      setSelectedCategory(cat);
      setSelectedSubcategory('');
    } else if (location.pathname === '/' && !location.search) {
      // Clear category filter when clicking All Products (path / with no search query)
      setSelectedCategory('');
      setSelectedSubcategory('');
    }
  }, [location.search, location.pathname]);

  // 1. Load catalog metadata once on mount using in-memory cache
  useEffect(() => {
    let isMounted = true;
    async function loadMetadata() {
      try {
        const meta = await getCatalogMetadata();
        if (isMounted) {
          setCategories(meta.categories || []);
          setSubcategories(meta.subcategories || []);
          setBrands(meta.brands || []);
          setSizes(meta.sizes || []);
        }
      } catch (err) {
        console.error('Failed to load metadata:', err.message);
      }
    }
    loadMetadata();
    return () => { isMounted = false; };
  }, []);

  // 2. Load filtered products when search/filter/sort options change
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const reqId = ++activeRequestId.current;

    async function loadFilteredProducts() {
      setLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch.trim()) queryParams.append('search', debouncedSearch.trim());

        if (selectedCategory) queryParams.append('category', selectedCategory);
        if (selectedSubcategory) queryParams.append('subcategory', selectedSubcategory);
        
        if (selectedBrand) queryParams.append('brand', selectedBrand);
        if (selectedSize) queryParams.append('size', selectedSize);
        if (selectedFit) queryParams.append('fit', selectedFit);
        if (minPrice) queryParams.append('minPrice', minPrice);
        if (maxPrice) queryParams.append('maxPrice', maxPrice);
        if (sortBy) queryParams.append('sortBy', sortBy);

        const productsRes = await api.get(`/products?${queryParams.toString()}`, { signal: controller.signal });
        // Discard response if a newer request was dispatched
        if (isMounted && reqId === activeRequestId.current) {
          setProducts(productsRes.data || []);
        }
      } catch (err) {
        if (err.name === 'AbortError' || err.code === 20) {
          return; // Ignore intentional cancellation
        }
        if (isMounted && reqId === activeRequestId.current) {
          console.error('Failed to load products:', err.message);
          setError(err.message);
        }
      } finally {
        if (isMounted && reqId === activeRequestId.current && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    loadFilteredProducts();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [debouncedSearch, selectedCategory, selectedSubcategory, selectedBrand, selectedSize, selectedFit, minPrice, maxPrice, sortBy]);


  // Sync temporary filter states when filters drawer opens
  useEffect(() => {
    if (isFilterDrawerOpen) {
      setTempBrand(selectedBrand);
      setTempSize(selectedSize);
      setTempFit(selectedFit);
      setTempMinPrice(minPrice);
      setTempMaxPrice(maxPrice);
      setTempSortBy(sortBy);
    }
  }, [isFilterDrawerOpen]);

  const productsMap = React.useMemo(() => {
    const map = new Map();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  const handleWishlistToggle = React.useCallback(async (e, productId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      if (isInWishlist(productId)) {
        await removeFromWishlist(productId);
      } else {
        const productMeta = productsMap.get(productId) || null;
        await addToWishlist(productId, productMeta);
      }
    } catch (err) {
      alert(err.message);
    }
  }, [isAuthenticated, isInWishlist, removeFromWishlist, addToWishlist, navigate, productsMap]);

  const handleApplyFilters = React.useCallback(() => {
    setSelectedBrand(tempBrand);
    setSelectedSize(tempSize);
    setSelectedFit(tempFit);
    setMinPrice(tempMinPrice);
    setMaxPrice(tempMaxPrice);
    setSortBy(tempSortBy);
    setIsFilterDrawerOpen(false);
  }, [tempBrand, tempSize, tempFit, tempMinPrice, tempMaxPrice, tempSortBy]);

  const handleClearFilters = React.useCallback(() => {
    setTempBrand('');
    setTempSize('');
    setTempFit('');
    setTempMinPrice('');
    setTempMaxPrice('');
    setTempSortBy('newest');

    setSelectedBrand('');
    setSelectedSize('');
    setSelectedFit('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
    setIsFilterDrawerOpen(false);
  }, []);

  const handleSelectCategory = React.useCallback((catSlug) => {
    setSelectedCategory(catSlug);
    setSelectedSubcategory('');
  }, []);

  const handleSelectCategoryAndScroll = React.useCallback((catSlug) => {
    handleSelectCategory(catSlug);
    const explorer = document.getElementById('catalog-explorer');
    if (explorer) {
      explorer.scrollIntoView({ behavior: 'smooth' });
    }
  }, [handleSelectCategory]);

  const handleSelectSubcategory = React.useCallback((catSlug, subcatSlug) => {
    setSelectedCategory(catSlug);
    setSelectedSubcategory(subcatSlug);
  }, []);

  const handleClearAllCategoryFilters = React.useCallback(() => {
    setSelectedCategory('');
    setSelectedSubcategory('');
  }, []);

  return (
    <BaseLayout>
      {/* Category Promotional Slider */}
      <CategorySlider categories={categories} onSelectCategory={handleSelectCategoryAndScroll} />

      {/* Main Catalog Explorer */}
      <div id="catalog-explorer" className="w-full max-w-full lg:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-12 flex-grow flex flex-col lg:flex-row gap-8 overflow-x-hidden min-w-0">
        
        {/* DESKTOP: Filters Sidebar (Hidden on Mobile) */}
        <aside className="hidden lg:block w-64 flex-shrink-0 space-y-6">
          <div className="menx-card p-5 rounded-2xl space-y-6">
            <div className="flex items-center space-x-2 text-menx-text font-bold pb-4 border-b border-menx-border">
              <SlidersHorizontal className="w-4 h-4 text-menx-primary" />
              <span>Filters & Sort</span>
            </div>

            {/* Sort options */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-menx-text-secondary uppercase tracking-wider">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-menx-bg border border-menx-border text-sm text-menx-text rounded-lg p-2.5 focus:border-menx-primary focus:outline-none"
              >
                <option value="newest">Newest Arrivals</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name-asc">Name: A to Z</option>
                <option value="name-desc">Name: Z to A</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-menx-text-secondary uppercase tracking-wider">Category</label>
              <div className="flex flex-col space-y-1.5">
                <button
                  onClick={handleClearAllCategoryFilters}
                  className={`text-left text-sm py-1.5 px-2 rounded-lg transition-colors flex items-center justify-between ${
                    selectedCategory === '' ? 'bg-menx-primary/10 text-menx-primary font-semibold' : 'text-menx-text-secondary hover:text-menx-text'
                  }`}
                >
                  <span>All Categories</span>
                  {selectedCategory === '' && <Check className="w-3.5 h-3.5" />}
                </button>
                {/* Desktop uses seeded categories from database */}
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleSelectCategory(cat.slug)}
                    className={`text-left text-sm py-1.5 px-2 rounded-lg transition-colors flex items-center justify-between ${
                      selectedCategory === cat.slug ? 'bg-menx-primary/10 text-menx-primary font-semibold' : 'text-menx-text-secondary hover:text-menx-text'
                    }`}
                  >
                    <span>{cat.name}</span>
                    {selectedCategory === cat.slug && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Brand Filter */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-menx-text-secondary uppercase tracking-wider">Brand</label>
              <div className="flex flex-col space-y-1.5">
                <button
                  onClick={() => setSelectedBrand('')}
                  className={`text-left text-sm py-1.5 px-2 rounded-lg transition-colors flex items-center justify-between ${
                    selectedBrand === '' ? 'bg-menx-primary/10 text-menx-primary font-semibold' : 'text-menx-text-secondary hover:text-menx-text'
                  }`}
                >
                  <span>All Brands</span>
                  {selectedBrand === '' && <Check className="w-3.5 h-3.5" />}
                </button>
                {brands.map((brand) => (
                  <button
                    key={brand.id}
                    onClick={() => setSelectedBrand(brand.slug)}
                    className={`text-left text-sm py-1.5 px-2 rounded-lg transition-colors flex items-center justify-between ${
                      selectedBrand === brand.slug ? 'bg-menx-primary/10 text-menx-primary font-semibold' : 'text-menx-text-secondary hover:text-menx-text'
                    }`}
                  >
                    <span>{brand.name}</span>
                    {selectedBrand === brand.slug && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* MOBILE & TABLET: Top Catalog Controls Header (Hidden on Desktop) */}
        <div className="block lg:hidden w-full max-w-full overflow-hidden space-y-4 mb-4">
          {/* Mobile Search input */}
          <div className="relative">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-menx-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full bg-menx-surface border border-menx-border rounded-xl pl-12 pr-10 py-3 text-sm text-menx-text placeholder-menx-text-muted focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-amber-500 transition-all shadow-md"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3.5 top-3 text-menx-text-muted hover:text-menx-text p-1 rounded-md focus:outline-none"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Drawer buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setIsCategoryDrawerOpen(true)}
              className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border border-menx-border bg-menx-surface text-sm font-semibold text-menx-text active:bg-menx-surface-elevated hover:bg-menx-surface-elevated transition-colors"
            >
              <span>Categories</span>
              <ChevronRight className="w-4 h-4 text-menx-text-secondary rotate-90" />
            </button>
            <button
              onClick={() => setIsFilterDrawerOpen(true)}
              className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border border-menx-border bg-menx-surface text-sm font-semibold text-menx-text active:bg-menx-surface-elevated hover:bg-menx-surface-elevated transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4 text-menx-primary" />
              <span>Filters</span>
            </button>
          </div>

          {/* Horizontally scrollable category row wrapper */}
          <div className="w-full overflow-hidden flex-shrink-0">
            <div className="flex overflow-x-auto space-x-2 pb-2 -mx-4 px-4 mobile-category-scroll">
              <button
                onClick={handleClearAllCategoryFilters}
                className={`flex-shrink-0 text-xs px-4 py-2 rounded-full border transition-all ${
                  selectedCategory === ''
                    ? 'border-menx-primary bg-menx-primary/10 text-menx-primary font-bold'
                    : 'border-menx-border bg-menx-surface text-menx-text-secondary hover:text-menx-text'
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id || cat.slug}
                  onClick={() => handleSelectCategory(cat.slug)}
                  className={`flex-shrink-0 text-xs px-4 py-2 rounded-full border transition-all ${
                    selectedCategory === cat.slug
                      ? 'border-menx-primary bg-menx-primary/10 text-menx-primary font-bold'
                      : 'border-menx-border bg-menx-surface text-menx-text-secondary hover:text-menx-text'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search & Grid Content */}
        <div className="w-full min-w-0 flex-grow space-y-6">
          {/* Desktop Search bar (Hidden on Mobile) */}
          <div className="hidden lg:block relative">
            <Search className="absolute left-3.5 top-3.5 w-5 h-5 text-menx-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name, materials or description..."
              className="w-full bg-menx-surface border border-menx-border rounded-xl pl-12 pr-10 py-3.5 text-sm text-menx-text placeholder-menx-text-muted focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-amber-500 transition-all shadow-md"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3.5 top-3.5 text-menx-text-muted hover:text-menx-text p-1 rounded-md focus:outline-none"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Subtle non-destructive filter loading indicator */}
          {loading && products.length > 0 && (
            <div className="w-full h-1 bg-menx-surface overflow-hidden rounded-full">
              <div className="w-full h-full bg-menx-primary animate-pulse" />
            </div>
          )}

          {/* Catalog Listing */}
          {loading && products.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-menx-surface border border-menx-border rounded-xl overflow-hidden shadow-md flex flex-col animate-pulse">
                  <div className="w-full aspect-[4/5] bg-menx-bg/80 flex items-center justify-center relative" />
                  <div className="p-3 sm:p-5 flex-grow flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="h-3.5 bg-menx-surface-elevated rounded w-3/4" />
                      <div className="h-2.5 bg-menx-surface-elevated rounded w-1/2" />
                    </div>
                    <div className="pt-2 border-t border-menx-border flex justify-between items-center">
                      <div className="h-4 bg-menx-surface-elevated rounded w-16" />
                      <div className="h-3.5 bg-menx-surface-elevated rounded w-8" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-menx-error/10 border border-menx-error/20 text-menx-error p-6 rounded-xl text-center">
              <p>Error retrieving catalog data: {error}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="menx-card p-12 rounded-2xl text-center text-menx-text-muted space-y-3">
              <ShoppingBag className="w-12 h-12 mx-auto text-menx-text-muted" />
              <h3 className="text-menx-text font-bold text-base">No products found</h3>
              <p className="text-sm">Try relaxing your search terms or filter constraints.</p>
            </div>
          ) : (
             /* Responsive 2-column mobile grid, 3-column desktop grid */
            <div className={`grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0 transition-opacity duration-200 ${loading ? 'opacity-75 pointer-events-none' : 'opacity-100'}`}>
              {products.map((product) => {
                const priceInfo = getProductPrice(product);
                const wishlistActive = isInWishlist(product.id);

                return (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    slug={product.slug}
                    title={product.title}
                    thumbnailUrl={product.thumbnailUrl}
                    brandName={product.brand?.name || 'MenX'}
                    categoryName={product.category?.name || ''}
                    subcategoryName={product.subcategory?.name || ''}
                    description={product.description || ''}
                    sellingPrice={priceInfo.sellingPrice}
                    mrp={priceInfo.mrp}
                    hasDiscount={priceInfo.hasDiscount}
                    wishlistActive={wishlistActive}
                    onWishlistToggle={handleWishlistToggle}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MOBILE DRAWERS */}

      {/* Category Drawer overlay & sheet */}
      {isCategoryDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setIsCategoryDrawerOpen(false);
              setDrawerActiveCategory(null);
            }}
          />

          {/* Drawer content */}
          <div className="relative z-50 bg-menx-surface-elevated border-t border-menx-border rounded-t-3xl p-6 max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-menx-border mb-4 flex-shrink-0">
              <div className="flex items-center space-x-2">
                {drawerActiveCategory && (
                  <button
                    onClick={() => setDrawerActiveCategory(null)}
                    className="p-1 text-menx-text-secondary hover:text-menx-text rounded-lg bg-menx-surface-elevated mr-2"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <h3 className="text-lg font-bold text-white">
                  {drawerActiveCategory ? drawerActiveCategory.name : 'Categories'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsCategoryDrawerOpen(false);
                  setDrawerActiveCategory(null);
                }}
                className="p-1.5 text-menx-text-secondary hover:text-menx-text rounded-lg bg-menx-surface-elevated"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drilldown Category List */}
            <div className="overflow-y-auto flex-grow space-y-2">
              {!drawerActiveCategory ? (
                <>
                  <button
                    onClick={() => {
                      handleClearAllCategoryFilters();
                      setIsCategoryDrawerOpen(false);
                    }}
                    className={`w-full text-left py-3.5 px-4 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between ${
                      selectedCategory === ''
                        ? 'bg-menx-primary/10 text-menx-primary border border-menx-primary/25'
                        : 'bg-menx-bg text-menx-text border border-menx-border hover:bg-menx-surface-elevated'
                    }`}
                  >
                    <span>All Categories</span>
                    {selectedCategory === '' && <Check className="w-4 h-4 text-menx-primary" />}
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id || cat.slug}
                      onClick={() => setDrawerActiveCategory(cat)}
                      className="w-full text-left py-3.5 px-4 rounded-xl text-sm font-semibold bg-menx-bg text-menx-text border border-menx-border hover:bg-menx-surface-elevated transition-colors flex items-center justify-between"
                    >
                      <span>{cat.name}</span>
                      <ChevronRight className="w-4 h-4 text-menx-text-muted" />
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {/* Select main category from the subcategories list */}
                  <button
                    onClick={() => {
                      handleSelectCategory(drawerActiveCategory.slug);
                      setIsCategoryDrawerOpen(false);
                      setDrawerActiveCategory(null);
                    }}
                    className={`w-full text-left py-3.5 px-4 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between ${
                      selectedCategory === drawerActiveCategory.slug && selectedSubcategory === ''
                        ? 'bg-menx-primary/10 text-menx-primary border border-menx-primary/25'
                        : 'bg-menx-bg text-menx-text border border-menx-border hover:bg-menx-surface-elevated'
                    }`}
                  >
                    <span>All {drawerActiveCategory.name}</span>
                    {selectedCategory === drawerActiveCategory.slug && selectedSubcategory === '' && (
                      <Check className="w-4 h-4 text-menx-primary" />
                    )}
                  </button>

                  {/* Render Subcategories */}
                  {subcategories
                    .filter((s) => s.category_id === drawerActiveCategory.id || s.category?.slug === drawerActiveCategory.slug || s.category?.id === drawerActiveCategory.id)
                    .map((sub) => (
                      <button
                        key={sub.id || sub.slug}
                        onClick={() => {
                          handleSelectSubcategory(drawerActiveCategory.slug, sub.slug);
                          setIsCategoryDrawerOpen(false);
                          setDrawerActiveCategory(null);
                        }}
                        className={`w-full text-left py-3.5 px-4 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between ${
                          selectedSubcategory === sub.slug
                            ? 'bg-menx-primary/10 text-menx-primary border border-menx-primary/25'
                            : 'bg-menx-bg text-menx-text border border-menx-border hover:bg-menx-surface-elevated'
                        }`}
                      >
                        <span>{sub.name}</span>
                        {selectedSubcategory === sub.slug && <Check className="w-4 h-4 text-menx-primary" />}
                      </button>
                    ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters Drawer overlay & sheet */}
      {isFilterDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsFilterDrawerOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative z-50 bg-menx-surface-elevated border-t border-menx-border rounded-t-3xl p-6 max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-menx-border mb-4 flex-shrink-0">
              <h3 className="text-lg font-bold text-white">Filters & Sort</h3>
              <button
                onClick={() => setIsFilterDrawerOpen(false)}
                className="p-1.5 text-menx-text-secondary hover:text-menx-text rounded-lg bg-menx-surface-elevated"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Fields form content */}
            <div className="overflow-y-auto flex-grow space-y-5 pb-6">
              
              {/* Sort By Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-menx-text-secondary uppercase tracking-wider">Sort By</label>
                <select
                  value={tempSortBy}
                  onChange={(e) => setTempSortBy(e.target.value)}
                  className="w-full bg-menx-bg border border-menx-border text-sm text-menx-text rounded-lg p-2.5 focus:border-menx-primary focus:outline-none"
                >
                  <option value="newest">Newest Arrivals</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="name-asc">Name: A to Z</option>
                  <option value="name-desc">Name: Z to A</option>
                </select>
              </div>

              {/* Price Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-menx-text-secondary uppercase tracking-wider">Price Range (₹)</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    placeholder="Min"
                    value={tempMinPrice}
                    onChange={(e) => setTempMinPrice(e.target.value)}
                    className="w-full bg-menx-bg border border-menx-border text-sm text-menx-text rounded-lg p-2.5 focus:border-menx-primary focus:outline-none placeholder-menx-text-muted"
                  />
                  <span className="text-menx-text-muted">—</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={tempMaxPrice}
                    onChange={(e) => setTempMaxPrice(e.target.value)}
                    className="w-full bg-menx-bg border border-menx-border text-sm text-menx-text rounded-lg p-2.5 focus:border-menx-primary focus:outline-none placeholder-menx-text-muted"
                  />
                </div>
              </div>

              {/* Size Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-menx-text-secondary uppercase tracking-wider">Size</label>
                <div className="flex flex-wrap gap-2">
                  {displaySizes.map((sz) => (
                    <button
                      key={sz.id || sz.name}
                      onClick={() => setTempSize(tempSize === sz.name ? '' : sz.name)}
                      className={`text-xs px-3.5 py-2 rounded-lg border transition-all ${
                        tempSize === sz.name
                          ? 'border-menx-primary bg-menx-primary/10 text-menx-primary font-bold'
                          : 'border-menx-border bg-menx-bg text-menx-text-secondary hover:text-menx-text'
                      }`}
                    >
                      {sz.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fit Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-menx-text-secondary uppercase tracking-wider">Fit</label>
                <div className="flex flex-wrap gap-2">
                  {['Slim Fit', 'Regular Fit', 'Straight Fit', 'Relaxed Fit'].map((fitOption) => (
                    <button
                      key={fitOption}
                      onClick={() => setTempFit(tempFit === fitOption ? '' : fitOption)}
                      className={`text-xs px-3.5 py-2 rounded-lg border transition-all ${
                        tempFit === fitOption
                          ? 'border-menx-primary bg-menx-primary/10 text-menx-primary font-bold'
                          : 'border-menx-border bg-menx-bg text-menx-text-secondary hover:text-menx-text'
                      }`}
                    >
                      {fitOption}
                    </button>
                  ))}
                </div>
              </div>

              {/* Brand Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-menx-text-secondary uppercase tracking-wider">Brand</label>
                <div className="flex flex-wrap gap-2">
                  {brands.map((brand) => (
                    <button
                      key={brand.id}
                      onClick={() => setTempBrand(tempBrand === brand.slug ? '' : brand.slug)}
                      className={`text-xs px-3.5 py-2 rounded-lg border transition-all ${
                        tempBrand === brand.slug
                          ? 'border-menx-primary bg-menx-primary/10 text-menx-primary font-bold'
                          : 'border-menx-border bg-menx-bg text-menx-text-secondary hover:text-menx-text'
                      }`}
                    >
                      {brand.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-menx-border pt-4 grid grid-cols-2 gap-4 flex-shrink-0">
              <button
                onClick={handleClearFilters}
                className="py-3 text-sm font-bold text-menx-text-secondary hover:text-menx-text rounded-xl border border-menx-border bg-menx-bg active:bg-gray-900 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleApplyFilters}
                className="py-3 text-sm font-extrabold text-[#0B0F14] bg-menx-primary hover:bg-menx-primary-hover rounded-xl transition-all shadow-md shadow-menx-primary/20"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </BaseLayout>
  );
}
