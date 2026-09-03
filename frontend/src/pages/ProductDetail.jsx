import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { ShoppingBag, Heart, ArrowLeft, ShieldAlert, Check } from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';
import { formatCurrency, getProductPrice, getVariantStock } from '../utils/formatters.js';

export default function ProductDetail() {
  const { slug } = useParams();
  const { isAuthenticated } = useAuth();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selector states
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    async function loadProductDetail() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/products/${slug}`);
        const productData = res.data;
        setProduct(productData);

        // Initialize main image
        const primaryImg = productData?.images?.find(img => img.is_primary) || productData?.images?.[0];
        setSelectedImage(primaryImg ? primaryImg.imageUrl : '');

        // Pre-select first color/size combinations if variants exist
        if (productData?.variants && productData.variants.length > 0) {
          const rawColors = [...new Set(productData.variants.map(v => typeof v.color === 'object' ? v.color?.name : v.color).filter(Boolean))];
          const initialColor = rawColors[0] || '';
          
          const rawSizes = productData.variants
            .filter(v => !initialColor || (typeof v.color === 'object' ? v.color?.name : v.color) === initialColor)
            .map(v => typeof v.size === 'object' ? v.size?.name : v.size)
            .filter(Boolean);
          const initialSize = rawSizes[0] || '';

          setSelectedColor(initialColor);
          setSelectedSize(initialSize);

          const matched = productData.variants.find(v => {
            const vColor = typeof v.color === 'object' ? v.color?.name : (v.color || '');
            const vSize = typeof v.size === 'object' ? v.size?.name : (v.size || '');
            return (!initialColor || vColor === initialColor) && (!initialSize || vSize === initialSize);
          }) || productData.variants[0];

          setSelectedVariant(matched || null);
        }
      } catch (err) {
        console.error('Failed to load product detail:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadProductDetail();
  }, [slug]);

  const handleColorChange = (color) => {
    setSelectedColor(color);
    if (!product || !product.variants) return;

    const availableSizes = product.variants
      .filter(v => (typeof v.color === 'object' ? v.color?.name : v.color) === color)
      .map(v => typeof v.size === 'object' ? v.size?.name : v.size)
      .filter(Boolean);

    let nextSize = selectedSize;
    if (availableSizes.length > 0 && !availableSizes.includes(selectedSize)) {
      nextSize = availableSizes[0];
      setSelectedSize(nextSize);
    }

    const matched = product.variants.find(v => {
      const vColor = typeof v.color === 'object' ? v.color?.name : (v.color || '');
      const vSize = typeof v.size === 'object' ? v.size?.name : (v.size || '');
      return vColor === color && (!nextSize || vSize === nextSize);
    }) || product.variants.find(v => (typeof v.color === 'object' ? v.color?.name : v.color) === color) || null;

    setSelectedVariant(matched);
  };

  const handleSizeChange = (size) => {
    setSelectedSize(size);
    if (!product || !product.variants) return;

    const matched = product.variants.find(v => {
      const vColor = typeof v.color === 'object' ? v.color?.name : (v.color || '');
      const vSize = typeof v.size === 'object' ? v.size?.name : (v.size || '');
      return (!selectedColor || vColor === selectedColor) && vSize === size;
    }) || null;

    setSelectedVariant(matched);
  };

  const handleWishlistToggle = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      if (isInWishlist(product.id)) {
        await removeFromWishlist(product.id);
      } else {
        await addToWishlist(product.id);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    try {
      await addToCart(selectedVariant.id, 1);
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } catch (err) {
      alert(err.message || 'Failed to add item to cart');
    }
  };

  if (loading) {
    return (
      <BaseLayout>
        <div className="flex-grow flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
        </div>
      </BaseLayout>
    );
  }

  if (error || !product) {
    return (
      <BaseLayout>
        <div className="max-w-md mx-auto my-16 p-8 bg-gray-900 border border-gray-800 rounded-2xl text-center space-y-4 shadow-2xl">
          <ShieldAlert className="w-12 h-12 mx-auto text-red-500" />
          <h2 className="text-xl font-bold tracking-tight text-white">Product Not Found</h2>
          <p className="text-sm text-gray-400">
            The collection item you requested could not be retrieved. It may have been unpublished or removed.
          </p>
          <Link
            to="/"
            className="inline-flex items-center space-x-2 text-sm font-semibold text-amber-500 hover:text-amber-400"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Catalog</span>
          </Link>
        </div>
      </BaseLayout>
    );
  }

  const hasColors = (product?.variants || []).some(v => (typeof v.color === 'object' ? v.color?.name : v.color));
  const hasSizes = (product?.variants || []).some(v => (typeof v.size === 'object' ? v.size?.name : v.size));

  const uniqueColors = hasColors
    ? [...new Set(product.variants.map(v => (typeof v.color === 'object' ? v.color?.name : v.color)).filter(Boolean))]
    : [];

  const uniqueSizes = hasSizes
    ? [...new Set(
        (hasColors && selectedColor
          ? product.variants.filter(v => (typeof v.color === 'object' ? v.color?.name : v.color) === selectedColor)
          : product.variants
        ).map(v => (typeof v.size === 'object' ? v.size?.name : v.size)).filter(Boolean)
      )]
    : [];

  const primaryImage = product?.images?.find(img => img.is_primary) || product?.images?.[0];
  const wishlistActive = product ? isInWishlist(product.id) : false;
  const stockInfo = getVariantStock(selectedVariant);

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow space-y-8">
        
        {/* Back Link */}
        <Link
          to="/"
          className="inline-flex items-center space-x-1.5 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to catalog</span>
        </Link>

        {/* Product Details Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          
          {/* Images Gallery */}
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl h-[400px] flex items-center justify-center overflow-hidden relative shadow-lg">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={product.title}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`;
                  }}
                  className="w-full h-full object-contain p-4"
                />
              ) : (
                <ShoppingBag className="w-24 h-24 text-gray-800" />
              )}

              {/* Brand tag */}
              <span className="absolute bottom-6 left-6 text-xs font-bold font-mono tracking-wider bg-gray-950/80 text-amber-500 border border-amber-500/20 px-3.5 py-1.5 rounded-full uppercase">
                {product.brand?.name || 'MenX'}
              </span>
            </div>

            {/* Sub-images indicator */}
            {product.images && product.images.length > 1 && (
              <div className="flex gap-3">
                {product.images.map((img) => {
                  const isActive = selectedImage === img.imageUrl;
                  return (
                    <div
                      key={img.id}
                      onClick={() => setSelectedImage(img.imageUrl)}
                      className={`w-20 h-20 bg-gray-900 border rounded-lg overflow-hidden flex-shrink-0 cursor-pointer transition-all ${
                        isActive
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-gray-800 hover:border-amber-500'
                      }`}
                    >
                      <img 
                        src={img.imageUrl} 
                        alt="" 
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`;
                        }}
                        className="w-full h-full object-contain p-2" 
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Product Actions */}
          <div className="space-y-6">
            
            {/* Title & Taxonomy */}
            <div className="space-y-2">
              <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                {product.category?.name} / {product.subcategory?.name}
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">{product.title}</h1>
              <p className="text-sm text-gray-400">{product.description}</p>
            </div>

            {/* Pricing Details */}
            <div className="bg-gray-900 border border-gray-850 p-6 rounded-xl space-y-4 shadow-md">
              {(() => {
                const priceInfo = getProductPrice(product, selectedVariant);
                return (
                  <div className="flex items-baseline space-x-3">
                    <span className="text-3xl font-black text-amber-400">
                      {formatCurrency(priceInfo.sellingPrice)}
                    </span>
                    {priceInfo.hasDiscount && (
                      <span className="text-sm text-gray-500 line-through font-medium">
                        {formatCurrency(priceInfo.mrp)}
                      </span>
                    )}
                    {priceInfo.hasDiscount && (
                      <span className="text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">
                        {priceInfo.discountPercent}% OFF
                      </span>
                    )}
                  </div>
                );
              })()}

              {selectedVariant && (
                <div className="flex items-center space-x-2 text-xs font-semibold">
                  <span className="text-gray-400">SKU:</span>
                  <span className="font-mono text-gray-200">{selectedVariant.sku}</span>
                </div>
              )}
            </div>

            {/* Variant Options Selector */}
            <div className="space-y-6">
              
              {/* Color selector */}
              {uniqueColors.length > 0 && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Color: {selectedColor}</label>
                  <div className="flex flex-wrap gap-3">
                    {uniqueColors.map((color) => {
                      const matchedColorObj = product.variants.find(v => (typeof v.color === 'object' ? v.color?.name : v.color) === color)?.color;
                      return (
                        <button
                          key={color}
                          onClick={() => handleColorChange(color)}
                          className={`flex items-center space-x-2 py-2 px-3 border rounded-lg text-xs font-semibold transition-all ${
                            selectedColor === color
                              ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                              : 'border-gray-800 bg-gray-950 text-gray-400 hover:text-white'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: matchedColorObj?.hex_code || '#fff' }}
                          />
                          <span>{color}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Size selector */}
              {uniqueSizes.length > 0 && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Size: {selectedSize}</label>
                  <div className="flex flex-wrap gap-3">
                    {uniqueSizes.map((size) => {
                      // Check stock specifically for this size under selected color
                      const sizeVariant = product.variants?.find(v => {
                        const vColor = typeof v.color === 'object' ? v.color?.name : (v.color || '');
                        const vSize = typeof v.size === 'object' ? v.size?.name : (v.size || '');
                        return (!selectedColor || vColor === selectedColor) && vSize === size;
                      });
                      const sizeStock = getVariantStock(sizeVariant);

                      return (
                        <button
                          key={size}
                          onClick={() => handleSizeChange(size)}
                          className={`py-2 px-4 border rounded-lg text-xs font-semibold tracking-wider font-mono transition-all ${
                            selectedSize === size
                              ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                              : sizeStock.isOutOfStock
                              ? 'border-gray-850 bg-gray-950 text-gray-600 line-through hover:border-gray-800'
                              : 'border-gray-800 bg-gray-950 text-gray-400 hover:text-white'
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Stock Availability indicator */}
            {selectedVariant && (
              <div className="flex items-center space-x-2 p-3 bg-gray-900 border border-gray-850 rounded-lg max-w-sm">
                <span className="text-xs text-gray-400">Availability:</span>
                <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${
                  stockInfo.inStock && !stockInfo.isLowStock
                    ? 'bg-green-500/10 border-green-500/20 text-green-400'
                    : stockInfo.isLowStock
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  {stockInfo.label.toUpperCase()}
                </span>
              </div>
            )}

            {/* CTA Actions */}
            <div className="flex gap-4 pt-4">
              
              {/* Add to Cart */}
              <button
                disabled={!selectedVariant || stockInfo.isOutOfStock || addedToCart}
                onClick={handleAddToCart}
                className={`flex-grow py-3 px-6 text-black font-bold rounded-lg transition-colors flex items-center justify-center space-x-2 ${
                  addedToCart
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-amber-500 hover:bg-amber-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed'
                }`}
              >
                {addedToCart ? (
                  <>
                    <Check className="w-5 h-5 text-black" />
                    <span>Added to Cart!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-5 h-5" />
                    <span>
                      {!selectedVariant
                        ? 'Select Size & Color'
                        : stockInfo.isOutOfStock
                        ? 'Out of Stock'
                        : 'Add to Cart'}
                    </span>
                  </>
                )}
              </button>

              {/* Wishlist toggle */}
              <button
                onClick={handleWishlistToggle}
                className={`py-3 px-4 border rounded-lg transition-colors flex items-center justify-center ${
                  wishlistActive
                    ? 'border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20'
                    : 'border-gray-800 bg-gray-950 text-gray-400 hover:text-white hover:border-gray-700'
                }`}
                title={wishlistActive ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <Heart className={`w-5 h-5 ${wishlistActive ? 'fill-red-500' : ''}`} />
              </button>

            </div>

          </div>

        </div>

      </div>
    </BaseLayout>
  );
}

