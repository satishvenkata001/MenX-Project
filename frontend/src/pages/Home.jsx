import React, { useEffect, useState } from 'react';
import { api } from '../utils/api.js';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ShoppingBag, ArrowRight, Heart, Search, SlidersHorizontal, Check, ChevronRight, X, ChevronLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';
import CategorySlider from '../components/CategorySlider.jsx';
import { formatCurrency, getProductPrice, getSafeLabel } from '../utils/formatters.js';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search, Filter & Sort states
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedFit, setSelectedFit] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Mobile Drawers Toggle States
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [drawerActiveCategory, setDrawerActiveCategory] = useState(null); // Selected main category in categories drawer

  // Temporary drawer states for Filter Drawer (Apply/Clear logic)
  const [tempBrand, setTempBrand] = useState('');
  const [tempSize, setTempSize] = useState('');
  const [tempColor, setTempColor] = useState('');
  const [tempFit, setTempFit] = useState('');
  const [tempMinPrice, setTempMinPrice] = useState('');
  const [tempMaxPrice, setTempMaxPrice] = useState('');
  const [tempSortBy, setTempSortBy] = useState('newest');
  
  const navigate = useNavigate();

  // Load products, categories, brands, sizes, colors
  useEffect(() => {
    async function loadCatalog() {
      setLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (search.trim()) queryParams.append('search', search);

        if (selectedCategory) queryParams.append('category', selectedCategory);
        if (selectedSubcategory) queryParams.append('subcategory', selectedSubcategory);
        
        if (selectedBrand) queryParams.append('brand', selectedBrand);
        if (selectedSize) queryParams.append('size', selectedSize);
        if (selectedColor) queryParams.append('color', selectedColor);
        if (selectedFit) queryParams.append('fit', selectedFit);
        if (minPrice) queryParams.append('minPrice', minPrice);
        if (maxPrice) queryParams.append('maxPrice', maxPrice);
        if (sortBy) queryParams.append('sortBy', sortBy);

        const [productsRes, categoriesRes, subcategoriesRes, brandsRes, sizesRes, colorsRes] = await Promise.all([
          api.get(`/products?${queryParams.toString()}`),
          api.get('/categories'),
          api.get('/subcategories'),
          api.get('/brands'),
          api.get('/sizes'),
          api.get('/colors')
        ]);
        
        setProducts(productsRes.data || []);
        setCategories(categoriesRes.data || []);
        setSubcategories(subcategoriesRes.data || []);
        setBrands(brandsRes.data || []);
        setSizes(sizesRes.data || []);
        setColors(colorsRes.data || []);
      } catch (err) {
        console.error('Failed to load catalog data:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, [search, selectedCategory, selectedSubcategory, selectedBrand, selectedSize, selectedColor, selectedFit, minPrice, maxPrice, sortBy]);

  // Sync temporary filter states when filters drawer opens
  useEffect(() => {
    if (isFilterDrawerOpen) {
      setTempBrand(selectedBrand);
      setTempSize(selectedSize);
      setTempColor(selectedColor);
      setTempFit(selectedFit);
      setTempMinPrice(minPrice);
      setTempMaxPrice(maxPrice);
      setTempSortBy(sortBy);
    }
  }, [isFilterDrawerOpen]);

  const handleWishlistToggle = async (e, productId) => {
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
        await addToWishlist(productId);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleApplyFilters = () => {
    setSelectedBrand(tempBrand);
    setSelectedSize(tempSize);
    setSelectedColor(tempColor);
    setSelectedFit(tempFit);
    setMinPrice(tempMinPrice);
    setMaxPrice(tempMaxPrice);
    setSortBy(tempSortBy);
    setIsFilterDrawerOpen(false);
  };

  const handleClearFilters = () => {
    setTempBrand('');
    setTempSize('');
    setTempColor('');
    setTempFit('');
    setTempMinPrice('');
    setTempMaxPrice('');
    setTempSortBy('newest');

    setSelectedBrand('');
    setSelectedSize('');
    setSelectedColor('');
    setSelectedFit('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
    setIsFilterDrawerOpen(false);
  };

  const handleSelectCategory = (catSlug) => {
    setSelectedCategory(catSlug);
    setSelectedSubcategory('');
  };

  const handleSelectCategoryAndScroll = (catSlug) => {
    handleSelectCategory(catSlug);
    const explorer = document.getElementById('catalog-explorer');
    if (explorer) {
      explorer.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectSubcategory = (catSlug, subcatSlug) => {
    setSelectedCategory(catSlug);
    setSelectedSubcategory(subcatSlug);
  };

  const handleClearAllCategoryFilters = () => {
    setSelectedCategory('');
    setSelectedSubcategory('');
  };

  return (
    <BaseLayout>
      {/* Category Promotional Slider */}
      <CategorySlider categories={categories} onSelectCategory={handleSelectCategoryAndScroll} />

      {/* Main Catalog Explorer */}
      <div id="catalog-explorer" className="w-full max-w-full lg:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-12 flex-grow flex flex-col lg:flex-row gap-8 overflow-x-hidden min-w-0">
        
        {/* DESKTOP: Filters Sidebar (Hidden on Mobile) */}
        <aside className="hidden lg:block w-64 flex-shrink-0 space-y-6">
          <div className="bg-gray-900 border border-gray-850 p-5 rounded-xl space-y-6">
            <div className="flex items-center space-x-2 text-white font-bold pb-4 border-b border-gray-800">
              <SlidersHorizontal className="w-4 h-4 text-amber-500" />
              <span>Filters & Sort</span>
            </div>

            {/* Sort options */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 text-sm text-gray-200 rounded-lg p-2.5 focus:border-amber-500 focus:outline-none"
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
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Category</label>
              <div className="flex flex-col space-y-1.5">
                <button
                  onClick={handleClearAllCategoryFilters}
                  className={`text-left text-sm py-1.5 px-2 rounded-lg transition-colors flex items-center justify-between ${
                    selectedCategory === '' ? 'bg-amber-500/10 text-amber-400 font-semibold' : 'text-gray-400 hover:text-white'
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
                      selectedCategory === cat.slug ? 'bg-amber-500/10 text-amber-400 font-semibold' : 'text-gray-400 hover:text-white'
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
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Brand</label>
              <div className="flex flex-col space-y-1.5">
                <button
                  onClick={() => setSelectedBrand('')}
                  className={`text-left text-sm py-1.5 px-2 rounded-lg transition-colors flex items-center justify-between ${
                    selectedBrand === '' ? 'bg-amber-500/10 text-amber-400 font-semibold' : 'text-gray-400 hover:text-white'
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
                      selectedBrand === brand.slug ? 'bg-amber-500/10 text-amber-400 font-semibold' : 'text-gray-400 hover:text-white'
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
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-md"
            />
          </div>

          {/* Drawer buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setIsCategoryDrawerOpen(true)}
              className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border border-gray-800 bg-gray-900 text-sm font-semibold text-white active:bg-gray-850 hover:bg-gray-850 transition-colors"
            >
              <span>Categories</span>
              <ChevronRight className="w-4 h-4 text-gray-400 rotate-90" />
            </button>
            <button
              onClick={() => setIsFilterDrawerOpen(true)}
              className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border border-gray-800 bg-gray-900 text-sm font-semibold text-white active:bg-gray-850 hover:bg-gray-850 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4 text-amber-500" />
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
                    ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold'
                    : 'border-gray-800 bg-gray-900 text-gray-400 hover:text-white'
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
                      ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold'
                      : 'border-gray-800 bg-gray-900 text-gray-400 hover:text-white'
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
            <Search className="absolute left-3.5 top-3.5 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name, materials or description..."
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-12 pr-4 py-3.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-md"
            />
          </div>

          {/* Catalog Listing */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-xl text-center">
              <p>Error retrieving catalog data: {error}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="bg-gray-900 border border-gray-850 p-12 rounded-xl text-center text-gray-500 space-y-2">
              <ShoppingBag className="w-12 h-12 mx-auto text-gray-700" />
              <h3 className="text-white font-semibold">No products found</h3>
              <p className="text-sm">Try relaxing your search terms or filter constraints.</p>
            </div>
          ) : (
             /* Responsive 2-column mobile grid, 3-column desktop grid */
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
              {products.map((product) => {
                const wishlistActive = isInWishlist(product.id);

                return (
                  <Link
                    key={product.id}
                    to={`/products/${product.slug}`}
                    className="group bg-gray-900 border border-gray-850 hover:border-gray-700 rounded-xl overflow-hidden shadow-md transition-all duration-250 flex flex-col relative min-w-0 w-full"
                  >
                    {/* Image Area */}
                    <div className="h-40 sm:h-60 bg-gray-950 flex items-center justify-center relative overflow-hidden">
                      {product.thumbnailUrl ? (
                        <img
                          src={product.thumbnailUrl}
                          alt={product.title}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`;
                          }}
                          className="w-full h-full max-w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <ShoppingBag className="w-12 h-12 sm:w-16 sm:h-16 text-gray-800" />
                      )}

                      {/* Wishlist toggle */}
                      <button
                        onClick={(e) => handleWishlistToggle(e, product.id)}
                        className={`absolute top-2 right-2 sm:top-4 sm:right-4 p-1.5 sm:p-2 rounded-full border shadow-md backdrop-blur-md transition-all duration-200 ${
                          wishlistActive
                            ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
                            : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${wishlistActive ? 'fill-red-500' : ''}`} />
                      </button>

                      {/* Brand Label */}
                      <span className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 text-[8px] sm:text-[10px] font-bold font-mono tracking-wider bg-gray-950/80 text-amber-500 border border-amber-500/20 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full uppercase">
                        {product.brand?.name || 'MenX'}
                      </span>
                    </div>

                    {/* Metadata Content */}
                    <div className="p-3 sm:p-5 flex-grow flex flex-col justify-between space-y-2 sm:space-y-4">
                      <div className="space-y-0.5 sm:space-y-1">
                        <h3 className="text-xs sm:text-base font-bold tracking-tight text-white group-hover:text-amber-500 transition-colors line-clamp-1">
                          {product.title}
                        </h3>
                        <p className="text-[8px] sm:text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                          {product.category?.name} / {product.subcategory?.name}
                        </p>
                        {/* Hide description on mobile to keep grid compact */}
                        <p className="hidden sm:block text-xs text-gray-400 line-clamp-2 pt-2">{product.description}</p>
                      </div>

                      {/* Price Section */}
                      <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-gray-850">
                        <div>
                          {(() => {
                            const priceInfo = getProductPrice(product);
                            return (
                              <div className="flex items-baseline">
                                <span className="text-xs sm:text-base font-bold text-amber-400">
                                  {formatCurrency(priceInfo.sellingPrice)}
                                </span>
                                {priceInfo.hasDiscount && (
                                  <span className="text-[8px] sm:text-[10px] text-gray-500 line-through ml-1.5 sm:ml-2">
                                    {formatCurrency(priceInfo.mrp)}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <span className="inline-flex items-center text-[8px] sm:text-[10px] font-bold text-amber-500 group-hover:translate-x-1 transition-transform">
                          <span className="hidden sm:inline">View Detail</span>
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </span>
                      </div>
                    </div>
                  </Link>
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
          <div className="relative z-50 bg-gray-900 border-t border-gray-800 rounded-t-3xl p-6 max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4 flex-shrink-0">
              <div className="flex items-center space-x-2">
                {drawerActiveCategory && (
                  <button
                    onClick={() => setDrawerActiveCategory(null)}
                    className="p-1 text-gray-400 hover:text-white rounded-lg bg-gray-800 mr-2"
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
                className="p-1.5 text-gray-400 hover:text-white rounded-lg bg-gray-800"
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
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                        : 'bg-gray-950 text-gray-300 border border-gray-850 hover:bg-gray-850'
                    }`}
                  >
                    <span>All Categories</span>
                    {selectedCategory === '' && <Check className="w-4 h-4 text-amber-500" />}
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id || cat.slug}
                      onClick={() => setDrawerActiveCategory(cat)}
                      className="w-full text-left py-3.5 px-4 rounded-xl text-sm font-semibold bg-gray-950 text-gray-300 border border-gray-850 hover:bg-gray-850 transition-colors flex items-center justify-between"
                    >
                      <span>{cat.name}</span>
                      <ChevronRight className="w-4 h-4 text-gray-500" />
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
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                        : 'bg-gray-950 text-gray-300 border border-gray-850 hover:bg-gray-850'
                    }`}
                  >
                    <span>All {drawerActiveCategory.name}</span>
                    {selectedCategory === drawerActiveCategory.slug && selectedSubcategory === '' && (
                      <Check className="w-4 h-4 text-amber-500" />
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
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                            : 'bg-gray-950 text-gray-300 border border-gray-850 hover:bg-gray-850'
                        }`}
                      >
                        <span>{sub.name}</span>
                        {selectedSubcategory === sub.slug && <Check className="w-4 h-4 text-amber-500" />}
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
          <div className="relative z-50 bg-gray-900 border-t border-gray-800 rounded-t-3xl p-6 max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4 flex-shrink-0">
              <h3 className="text-lg font-bold text-white">Filters & Sort</h3>
              <button
                onClick={() => setIsFilterDrawerOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Fields form content */}
            <div className="overflow-y-auto flex-grow space-y-5 pb-6">
              
              {/* Sort By Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sort By</label>
                <select
                  value={tempSortBy}
                  onChange={(e) => setTempSortBy(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-sm text-gray-200 rounded-lg p-2.5 focus:border-amber-500 focus:outline-none"
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
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Price Range (₹)</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    placeholder="Min"
                    value={tempMinPrice}
                    onChange={(e) => setTempMinPrice(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-850 text-sm text-white rounded-lg p-2.5 focus:border-amber-500 focus:outline-none placeholder-gray-600"
                  />
                  <span className="text-gray-500">—</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={tempMaxPrice}
                    onChange={(e) => setTempMaxPrice(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-850 text-sm text-white rounded-lg p-2.5 focus:border-amber-500 focus:outline-none placeholder-gray-600"
                  />
                </div>
              </div>

              {/* Size Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Size</label>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((sz) => (
                    <button
                      key={sz.id}
                      onClick={() => setTempSize(tempSize === sz.name ? '' : sz.name)}
                      className={`text-xs px-3.5 py-2 rounded-lg border transition-all ${
                        tempSize === sz.name
                          ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold'
                          : 'border-gray-800 bg-gray-950 text-gray-400 hover:text-white'
                      }`}
                    >
                      {sz.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Color</label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <button
                      key={color.id}
                      onClick={() => setTempColor(tempColor === color.name ? '' : color.name)}
                      className={`text-xs px-3.5 py-2 rounded-lg border transition-all flex items-center space-x-1.5 ${
                        tempColor === color.name
                          ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold'
                          : 'border-gray-800 bg-gray-950 text-gray-400 hover:text-white'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-gray-700 flex-shrink-0"
                        style={{ backgroundColor: color.hex_code }}
                      />
                      <span>{color.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fit Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fit</label>
                <div className="flex flex-wrap gap-2">
                  {['Slim Fit', 'Regular Fit', 'Straight Fit', 'Relaxed Fit'].map((fitOption) => (
                    <button
                      key={fitOption}
                      onClick={() => setTempFit(tempFit === fitOption ? '' : fitOption)}
                      className={`text-xs px-3.5 py-2 rounded-lg border transition-all ${
                        tempFit === fitOption
                          ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold'
                          : 'border-gray-800 bg-gray-950 text-gray-400 hover:text-white'
                      }`}
                    >
                      {fitOption}
                    </button>
                  ))}
                </div>
              </div>

              {/* Brand Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Brand</label>
                <div className="flex flex-wrap gap-2">
                  {brands.map((brand) => (
                    <button
                      key={brand.id}
                      onClick={() => setTempBrand(tempBrand === brand.slug ? '' : brand.slug)}
                      className={`text-xs px-3.5 py-2 rounded-lg border transition-all ${
                        tempBrand === brand.slug
                          ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold'
                          : 'border-gray-800 bg-gray-950 text-gray-400 hover:text-white'
                      }`}
                    >
                      {brand.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-gray-800 pt-4 grid grid-cols-2 gap-4 flex-shrink-0">
              <button
                onClick={handleClearFilters}
                className="py-3 text-sm font-bold text-gray-400 hover:text-white rounded-xl border border-gray-800 bg-gray-950 active:bg-gray-900 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleApplyFilters}
                className="py-3 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors shadow-md"
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
