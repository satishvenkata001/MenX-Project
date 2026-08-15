import React, { useEffect, useState } from 'react';
import { api } from '../utils/api.js';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ShoppingBag, ArrowRight, Heart, Search, SlidersHorizontal, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search, Filter & Sort states
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  
  const navigate = useNavigate();

  // Load products, categories, and brands on mount and when filter criteria changes
  useEffect(() => {
    async function loadCatalog() {
      setLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (search.trim()) queryParams.append('search', search);
        if (selectedCategory) queryParams.append('category', selectedCategory);
        if (selectedBrand) queryParams.append('brand', selectedBrand);
        if (sortBy) queryParams.append('sortBy', sortBy);

        const [productsRes, categoriesRes, brandsRes] = await Promise.all([
          api.get(`/products?${queryParams.toString()}`),
          api.get('/categories'),
          api.get('/brands')
        ]);
        
        setProducts(productsRes.data || []);
        setCategories(categoriesRes.data || []);
        setBrands(brandsRes.data || []);
      } catch (err) {
        console.error('Failed to load catalog data:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, [search, selectedCategory, selectedBrand, sortBy]);

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

  return (
    <BaseLayout>
      {/* Hero Banner */}
      <section className="bg-gradient-to-b from-gray-900 to-gray-950 py-12 px-4 text-center border-b border-gray-800">
        <div className="max-w-3xl mx-auto space-y-4">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-100 to-amber-500 bg-clip-text text-transparent">
            Curated Men's Sartorial Collection
          </h1>
          <p className="text-sm md:text-base text-gray-400 max-w-xl mx-auto">
            Explore authentic retail fashion crafted for durability and standard styling at our Talapudi outlet.
          </p>
        </div>
      </section>

      {/* Main Catalog Explorer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow flex flex-col lg:flex-row gap-8">
        
        {/* Filters Sidebar */}
        <aside className="w-full lg:w-64 flex-shrink-0 space-y-6">
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
                  onClick={() => setSelectedCategory('')}
                  className={`text-left text-sm py-1.5 px-2 rounded-lg transition-colors flex items-center justify-between ${
                    selectedCategory === '' ? 'bg-amber-500/10 text-amber-400 font-semibold' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span>All Categories</span>
                  {selectedCategory === '' && <Check className="w-3.5 h-3.5" />}
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.slug)}
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

        {/* Search & Grid Content */}
        <div className="flex-grow space-y-6">
          {/* Search bar */}
          <div className="relative">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => {
                const primaryImage = product.images?.find(img => img.is_primary) || product.images?.[0];
                const wishlistActive = isInWishlist(product.id);

                return (
                  <Link
                    key={product.id}
                    to={`/products/${product.slug}`}
                    className="group bg-gray-900 border border-gray-850 hover:border-gray-700 rounded-xl overflow-hidden shadow-md transition-all duration-250 flex flex-col relative"
                  >
                    {/* Image Area */}
                    <div className="h-60 bg-gray-950 flex items-center justify-center relative overflow-hidden">
                      {primaryImage ? (
                        <img
                          src={primaryImage.image_url}
                          alt={product.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <ShoppingBag className="w-16 h-16 text-gray-800" />
                      )}

                      {/* Wishlist toggle */}
                      <button
                        onClick={(e) => handleWishlistToggle(e, product.id)}
                        className={`absolute top-4 right-4 p-2 rounded-full border shadow-md backdrop-blur-md transition-all duration-200 ${
                          wishlistActive
                            ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
                            : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${wishlistActive ? 'fill-red-500' : ''}`} />
                      </button>

                      {/* Brand Label */}
                      <span className="absolute bottom-4 left-4 text-[10px] font-bold font-mono tracking-wider bg-gray-950/80 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-full uppercase">
                        {product.brand?.name || 'MenX'}
                      </span>
                    </div>

                    {/* Metadata Content */}
                    <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                      <div className="space-y-1">
                        <h3 className="font-bold tracking-tight text-white group-hover:text-amber-500 transition-colors line-clamp-1">
                          {product.title}
                        </h3>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                          {product.category?.name} / {product.subcategory?.name}
                        </p>
                        <p className="text-xs text-gray-400 line-clamp-2 pt-2">{product.description}</p>
                      </div>

                      {/* Price Section */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-850">
                        <div>
                          <span className="text-[10px] text-gray-500 line-through">₹{product.base_mrp}</span>
                          <span className="text-base font-bold text-amber-400 ml-2">₹{product.base_price}</span>
                        </div>
                        <span className="inline-flex items-center text-[10px] font-bold text-amber-500 group-hover:translate-x-1 transition-transform">
                          <span>View Detail</span>
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
    </BaseLayout>
  );
}
