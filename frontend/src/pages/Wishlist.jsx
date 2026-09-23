import React, { useState, memo } from 'react';
import { useWishlist } from '../context/WishlistContext.jsx';
import { ShoppingBag, Trash2, Heart, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';
import { formatCurrency, getProductPrice, getSafeLabel } from '../utils/formatters.js';

const WishlistCard = memo(function WishlistCard({ item, onRemove }) {
  const [imgError, setImgError] = useState(false);
  const product = item?.product || item;
  if (!product) return null;

  const productId = item.productId || item.product_id || product.productId || product.product_id || product.id;
  const title = product.title || item.title || 'Product';
  const slug = product.slug || item.slug;
  const brandName = getSafeLabel(product.brand || item.brand, '');
  const categoryName = getSafeLabel(product.category || item.category, '');
  const subcategoryName = getSafeLabel(product.subcategory || item.subcategory, '');
  const categoryPath = [categoryName, subcategoryName].filter(Boolean).join(' / ');

  const isAvailable = (product.status === 'PUBLISHED' || !product.status) && Boolean(slug);
  const imageUrl = product.thumbnailUrl || item.thumbnailUrl || product.imageUrl || product.images?.[0]?.imageUrl || product.images?.[0]?.image_url;
  const priceInfo = getProductPrice(product);

  const cardContent = (
    <div className="group menx-card-interactive rounded-xl sm:rounded-2xl overflow-hidden shadow-sm hover:shadow-xl flex flex-col relative h-full min-w-0 w-full">
      {/* 1. Product Image Stage (Edge-to-edge, Premium Fashion Aspect Ratio) */}
      <div className="aspect-[4/5] bg-[#0B0F14]/60 border-b border-menx-border/40 flex items-center justify-center relative overflow-hidden flex-shrink-0">
        {imageUrl && !imgError ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 select-none"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-menx-text-muted space-y-1 p-4">
            <ShoppingBag className="w-8 h-8 sm:w-10 sm:h-10 opacity-30" />
            <span className="text-[9px] sm:text-[10px] uppercase font-mono tracking-wider text-menx-text-muted font-bold">MENX</span>
          </div>
        )}

        {/* Wishlist Remove / Delete Action (Glassmorphism Pill) */}
        <button
          type="button"
          onClick={(e) => onRemove(e, productId)}
          className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#0B0F14]/70 hover:bg-[#0B0F14]/90 backdrop-blur-md border border-menx-border/80 flex items-center justify-center text-menx-text-secondary hover:text-menx-error transition-all duration-200 active:scale-90 shadow-sm cursor-pointer"
          aria-label={`Remove ${title} from wishlist`}
          title="Remove from wishlist"
        >
          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-menx-text-secondary hover:text-menx-error transition-colors" />
        </button>

        {/* Discount Tag (Overlaid on Image) */}
        {priceInfo.hasDiscount && priceInfo.discountPercent > 0 && (
          <div className="absolute bottom-2 left-2 px-1.5 sm:px-2 py-0.5 rounded-md bg-menx-primary/15 border border-menx-primary/40 text-[9px] sm:text-[10px] font-mono font-bold text-menx-primary backdrop-blur-sm">
            {priceInfo.discountPercent}% OFF
          </div>
        )}
      </div>

      {/* 2. Card Details Area (Compact, Fashion-Forward Layout) */}
      <div className="p-2.5 sm:p-4 flex flex-col flex-1 justify-between space-y-2 min-w-0">
        <div className="min-w-0">
          {/* Brand or Category Micro-Label */}
          {(brandName || categoryPath) && (
            <div className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-menx-text-muted truncate">
              {brandName || categoryPath}
            </div>
          )}

          {/* Product Title (2-Line Truncation with Balanced Height) */}
          <h3 className="text-xs sm:text-sm font-bold text-menx-text group-hover:text-menx-primary transition-colors line-clamp-2 mt-0.5 break-words leading-tight sm:leading-snug min-h-[2rem] sm:min-h-[2.5rem]">
            {title}
          </h3>
        </div>

        {/* Pricing Row */}
        <div className="pt-1 border-t border-menx-border/40 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-1.5 sm:gap-x-2 gap-y-0.5 min-w-0">
            <span className="text-xs sm:text-base font-black text-menx-text font-mono whitespace-nowrap">
              {formatCurrency(priceInfo.sellingPrice)}
            </span>
            {priceInfo.hasDiscount && (
              <span className="text-[10px] sm:text-xs text-menx-text-muted line-through font-mono whitespace-nowrap">
                {formatCurrency(priceInfo.mrp)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (isAvailable) {
    return (
      <Link to={`/products/${slug}`} className="block h-full min-w-0 group">
        {cardContent}
      </Link>
    );
  }

  return (
    <div className="block h-full min-w-0">
      {cardContent}
    </div>
  );
});

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

  const hasItems = Array.isArray(wishlist) && wishlist.length > 0;

  return (
    <BaseLayout>
      <div className="w-full max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-grow space-y-6 sm:space-y-8 min-w-0 box-border">
        
        {/* Header */}
        <div className="border-b border-menx-border pb-4 sm:pb-6 flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-menx-error/10 border border-menx-error/20 flex items-center justify-center shrink-0">
              <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-menx-error fill-red-500" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white truncate">Your Wishlist</h1>
              {hasItems && (
                <p className="text-[11px] sm:text-xs text-menx-text-secondary mt-0.5 font-medium">
                  {wishlist.length} {wishlist.length === 1 ? 'item' : 'items'} saved
                </p>
              )}
            </div>
          </div>
          {hasItems && (
            <Link
              to="/"
              className="inline-flex items-center space-x-1 sm:space-x-1.5 text-xs text-menx-primary hover:text-menx-primary-hover font-semibold transition-colors shrink-0"
            >
              <span>Explore</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {/* Loading / Error / Content states */}
        {loading && !hasItems ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-menx-primary"></div>
          </div>
        ) : error && !hasItems ? (
          <div className="bg-menx-error/10 border border-menx-error/20 text-menx-error p-6 rounded-xl text-center max-w-lg mx-auto">
            <p>Error loading wishlist: {error}</p>
          </div>
        ) : !hasItems ? (
          <div className="menx-card p-8 sm:p-12 rounded-2xl text-center text-menx-text-muted space-y-4 max-w-lg mx-auto shadow-xl my-8">
            <div className="w-16 h-16 bg-menx-bg border border-menx-border rounded-full flex items-center justify-center mx-auto">
              <Heart className="w-8 h-8 text-menx-text-muted" />
            </div>
            <h3 className="text-lg sm:text-xl text-white font-bold tracking-tight">Your Wishlist is Empty</h3>
            <p className="text-xs sm:text-sm text-menx-text-secondary max-w-md mx-auto leading-relaxed">
              Explore the storefront and save your favorite designer apparel and luxury essentials here.
            </p>
            <div className="pt-3">
              <Link
                to="/"
                className="inline-flex items-center space-x-2 py-3 px-6 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] font-bold rounded-xl transition-all duration-200 shadow-lg shadow-menx-primary/10 text-xs sm:text-sm cursor-pointer"
              >
                <span>Continue Shopping</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          /* Mobile-First 2-Column Product Grid */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-5 lg:gap-6 w-full min-w-0">
            {wishlist.map((item) => (
              <WishlistCard
                key={item.id || item.productId || item.product_id || item.product?.id}
                item={item}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}

      </div>
    </BaseLayout>
  );
}

