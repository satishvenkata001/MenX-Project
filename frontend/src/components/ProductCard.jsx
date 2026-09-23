import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../utils/formatters.js';

function ProductCardComponent({
  id,
  slug,
  title,
  thumbnailUrl,
  brandName,
  categoryName,
  subcategoryName,
  description,
  sellingPrice,
  mrp,
  hasDiscount,
  wishlistActive,
  onWishlistToggle
}) {
  return (
    <Link
      to={`/products/${slug}`}
      className="group menx-card-interactive rounded-xl sm:rounded-2xl overflow-hidden shadow-sm hover:shadow-xl flex flex-col relative min-w-0 w-full"
    >
      {/* Image Area with intrinsic aspect ratio */}
      <div className="w-full aspect-[4/5] bg-[#0B0F14]/80 border-b border-menx-border/40 flex items-center justify-center relative overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            width="300"
            height="375"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`;
            }}
            className="w-full h-full max-w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <ShoppingBag className="w-12 h-12 sm:w-16 sm:h-16 text-menx-text-muted/60" />
        )}

        {/* Wishlist toggle */}
        <button
          type="button"
          onClick={(e) => onWishlistToggle(e, id)}
          aria-label={wishlistActive ? `Remove ${title} from wishlist` : `Add ${title} to wishlist`}
          className={`absolute top-2 right-2 sm:top-4 sm:right-4 p-1.5 sm:p-2 rounded-full border shadow-md backdrop-blur-md transition-all duration-200 ${
            wishlistActive
              ? 'bg-menx-error/10 border-menx-error/20 text-menx-error hover:bg-menx-error/20'
              : 'bg-menx-surface/60 border-menx-border text-menx-text-secondary hover:text-menx-text'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${wishlistActive ? 'fill-menx-error text-menx-error' : ''}`} />
        </button>

        {/* Brand Label */}
        <span className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 text-[8px] sm:text-[10px] font-bold font-mono tracking-wider bg-menx-bg/80 text-menx-primary border border-menx-primary/20 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full uppercase">
          {brandName || 'MenX'}
        </span>
      </div>

      {/* Metadata Content */}
      <div className="p-3 sm:p-5 flex-grow flex flex-col justify-between space-y-2 sm:space-y-4">
        <div className="space-y-0.5 sm:space-y-1">
          <h3 className="text-xs sm:text-base font-bold tracking-tight text-menx-text group-hover:text-menx-primary transition-colors line-clamp-1">
            {title}
          </h3>
          <p className="text-[8px] sm:text-[10px] text-menx-text-secondary uppercase tracking-wider font-semibold">
            {categoryName} / {subcategoryName}
          </p>
          {/* Hide description on mobile to keep grid compact */}
          {description && (
            <p className="hidden sm:block text-xs text-menx-text-secondary line-clamp-2 pt-2">{description}</p>
          )}
        </div>

        {/* Price Section */}
        <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-menx-border">
          <div>
            <div className="flex items-baseline">
              <span className="text-xs sm:text-base font-bold text-menx-primary">
                {formatCurrency(sellingPrice)}
              </span>
              {hasDiscount && (
                <span className="text-[8px] sm:text-[10px] text-menx-text-muted line-through ml-1.5 sm:ml-2">
                  {formatCurrency(mrp)}
                </span>
              )}
            </div>
          </div>
          <span className="inline-flex items-center text-[8px] sm:text-[10px] font-bold text-menx-primary group-hover:translate-x-1 transition-transform">
            <span className="hidden sm:inline">View Detail</span>
            <ArrowRight className="w-3 h-3 ml-1" />
          </span>
        </div>
      </div>
    </Link>
  );
}

const ProductCard = React.memo(ProductCardComponent);
export default ProductCard;
