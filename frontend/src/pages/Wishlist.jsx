import React from 'react';
import { useWishlist } from '../context/WishlistContext.jsx';
import { ShoppingBag, Trash2, Heart, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';

export default function Wishlist() {
  const { wishlist, loading, error, removeFromWishlist } = useWishlist();

  const handleRemove = async (e, productId) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await removeFromWishlist(productId);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow space-y-8">
        
        {/* Header */}
        <div className="border-b border-gray-800 pb-6 flex items-center space-x-2">
          <Heart className="w-8 h-8 text-red-500 fill-red-500" />
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Your Wishlist</h1>
        </div>

        {/* Loading / Error states */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-xl text-center">
            <p>Error loading wishlist: {error}</p>
          </div>
        ) : wishlist.length === 0 ? (
          <div className="bg-gray-900 border border-gray-850 p-12 rounded-xl text-center text-gray-500 space-y-4 max-w-lg mx-auto shadow-lg">
            <Heart className="w-12 h-12 mx-auto text-gray-700" />
            <h3 className="text-white font-semibold">Your Wishlist is Empty</h3>
            <p className="text-sm">Explore the storefront and add your favorite apparel items here.</p>
            <div className="pt-2">
              <Link
                to="/"
                className="inline-flex items-center space-x-2 py-2 px-4 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition-colors"
              >
                <span>Continue Shopping</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {wishlist.map((item) => {
              const product = item.product || item;
              if (!product) return null;
              
              const primaryImage = product.images?.find(img => img.is_primary) || product.images?.[0];

              return (
                <Link
                  key={product.id}
                  to={`/products/${product.slug}`}
                  className="group bg-gray-900 border border-gray-850 hover:border-gray-700 rounded-xl overflow-hidden shadow-md transition-all duration-250 flex flex-col relative"
                >
                  {/* Image Area */}
                  <div className="h-56 bg-gray-950 flex items-center justify-center relative overflow-hidden">
                    {primaryImage ? (
                      <img
                        src={primaryImage.image_url}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <ShoppingBag className="w-14 h-14 text-gray-800" />
                    )}

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleRemove(e, product.id)}
                      className="absolute top-4 right-4 p-2 rounded-full bg-gray-900/80 border border-gray-800 text-gray-400 hover:text-red-500 hover:bg-red-500/10 shadow-md transition-colors"
                      title="Remove from wishlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Brand tag */}
                    <span className="absolute bottom-4 left-4 text-[10px] font-bold font-mono tracking-wider bg-gray-950/80 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-full uppercase">
                      {product.brand?.name || 'MenX'}
                    </span>
                  </div>

                  {/* Metadata Area */}
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

                    {/* Pricing */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-850">
                      <div>
                        <span className="text-[10px] text-gray-500 line-through">₹{product.base_mrp}</span>
                        <span className="text-base font-bold text-amber-400 ml-2">₹{product.base_price}</span>
                      </div>
                      <span className="inline-flex items-center text-[10px] font-bold text-amber-500 group-hover:translate-x-1 transition-transform">
                        <span>View Details</span>
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
    </BaseLayout>
  );
}
