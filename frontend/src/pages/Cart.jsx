import React, { useState, memo } from 'react';
import { useCart } from '../context/CartContext.jsx';
import { ShoppingBag, Trash2, Plus, Minus, AlertTriangle, ArrowRight, Sparkles, ShieldCheck, Truck, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';
import { formatCurrency } from '../utils/formatters.js';

const CartItemCard = memo(function CartItemCard({ item, isUpdating, onQuantityChange, onRemoveItem }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`group ${
        !item.isAvailable
          ? 'border border-menx-error/30 bg-red-950/10'
          : 'menx-card hover:border-menx-primary/40'
      } rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 relative min-w-0 overflow-hidden h-full shadow-md hover:shadow-lg`}
    >
      {/* Top Section: Thumbnail + Info & Remove Button */}
      <div className="space-y-3 min-w-0">
        <div className="flex gap-3 sm:gap-4 items-start min-w-0">
          
          {/* Thumbnail Image */}
          <div className="w-20 sm:w-24 aspect-square bg-menx-bg border border-menx-border rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 relative">
            {item.thumbnailUrl && !imgError ? (
              <img
                src={item.thumbnailUrl}
                alt={item.productTitle || 'Cart item'}
                width="96"
                height="96"
                loading="lazy"
                decoding="async"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-menx-border">
                <ShoppingBag className="w-7 h-7 sm:w-8 sm:h-8" />
                <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-menx-text-muted mt-0.5">MENX</span>
              </div>
            )}
            
            {/* Invalid item overlay */}
            {!item.isAvailable && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-menx-error" />
              </div>
            )}
          </div>

          {/* Details & Remove Button */}
          <div className="flex-grow min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-1">
              <span className="text-[10px] font-bold font-mono tracking-wider text-menx-primary uppercase truncate">
                {item.sku ? `SKU: ${item.sku}` : 'MENX'}
              </span>

              {/* Remove Action */}
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => onRemoveItem(item.id)}
                className="p-1 -mr-1 -mt-1 rounded-lg text-menx-text-muted hover:text-menx-error hover:bg-menx-error/10 border border-transparent hover:border-menx-error/20 transition-colors disabled:opacity-40 flex-shrink-0"
                aria-label={`Remove ${item.productTitle} from cart`}
                title="Remove item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Product Title */}
            <Link
              to={`/products/${item.productSlug}`}
              className="font-bold text-white hover:text-menx-primary transition-colors text-sm sm:text-base line-clamp-2 break-words block leading-snug"
            >
              {item.productTitle}
            </Link>

            {/* Variant Tags */}
            <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] text-menx-text-secondary font-medium">
              {item.size && (
                <span className="bg-menx-bg border border-menx-border px-2 py-0.5 rounded text-gray-300">
                  Size: <strong className="text-white">{item.size}</strong>
                </span>
              )}
              {item.color && (
                <span className="bg-menx-bg border border-menx-border px-2 py-0.5 rounded text-gray-300">
                  Color: <strong className="text-white">{item.color}</strong>
                </span>
              )}
              {item.outfit && (
                <span className="bg-menx-primary/10 border border-menx-primary/20 text-menx-primary px-2 py-0.5 rounded flex items-center font-semibold max-w-full">
                  <Sparkles className="w-3 h-3 mr-1 flex-shrink-0" />
                  <span className="truncate max-w-[130px]">{item.outfit.title}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stock Alerts */}
        {!item.isAvailable && (
          <div className="text-xs bg-menx-error/10 border border-menx-error/20 text-menx-error p-2 rounded-lg flex items-center space-x-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="leading-tight">
              {item.availableStock === 0
                ? 'Out of stock. Please remove to proceed.'
                : `Exceeds stock (Only ${item.availableStock} available).`}
            </span>
          </div>
        )}
        
        {item.isAvailable && item.availableStock < 5 && (
          <div className="text-xs bg-menx-primary/10 border border-menx-primary/20 text-menx-primary p-2 rounded-lg flex items-center space-x-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Only {item.availableStock} left in stock. Order soon!</span>
          </div>
        )}
      </div>

      {/* Bottom Section: Pricing & Quantity Controls */}
      <div className="pt-3 mt-3 border-t border-menx-border flex items-center justify-between gap-2">
        
        {/* Pricing */}
        <div className="min-w-0">
          <div className="flex items-baseline space-x-1.5 flex-wrap">
            <span className="text-xs sm:text-sm font-bold text-menx-text font-mono">
              {formatCurrency(item.unitPrice)}
            </span>
            {item.mrp > item.unitPrice && (
              <span className="text-[11px] text-menx-text-muted line-through font-mono">
                {formatCurrency(item.mrp)}
              </span>
            )}
          </div>
          <div className="text-xs sm:text-sm font-bold text-menx-primary font-mono mt-0.5">
            Total: {formatCurrency(item.lineTotal)}
          </div>
        </div>

        {/* Quantity Controls */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 bg-menx-bg border border-menx-border p-1 rounded-lg flex-shrink-0">
          <button
            type="button"
            disabled={item.quantity <= 1 || isUpdating}
            onClick={() => onQuantityChange(item.id, item.quantity, -1, item.availableStock)}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-menx-surface hover:bg-menx-surface-elevated flex items-center justify-center text-menx-text-secondary hover:text-white disabled:opacity-30 disabled:hover:text-menx-text-secondary transition-colors"
            aria-label={`Decrease quantity of ${item.productTitle}`}
            title="Decrease quantity"
          >
            <Minus className="w-3 h-3" />
          </button>
          
          <span className="w-5 sm:w-6 text-center font-bold text-xs sm:text-sm text-white font-mono">
            {item.quantity}
          </span>
          
          <button
            type="button"
            disabled={item.quantity >= 10 || item.quantity >= item.availableStock || isUpdating}
            onClick={() => onQuantityChange(item.id, item.quantity, 1, item.availableStock)}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-menx-surface hover:bg-menx-surface-elevated flex items-center justify-center text-menx-text-secondary hover:text-white disabled:opacity-30 disabled:hover:text-menx-text-secondary transition-colors"
            aria-label={`Increase quantity of ${item.productTitle}`}
            title="Increase quantity"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

      </div>
    </div>
  );
});

export default function Cart() {
  const { cart, loading, error, updateQuantity, removeFromCart, clearCart, isItemUpdating } = useCart();
  const [clearing, setClearing] = useState(false);
  const navigate = useNavigate();

  const handleQuantityChange = async (itemId, currentQty, delta, stock) => {
    const newQty = currentQty + delta;
    if (newQty < 1 || newQty > 10 || newQty > stock) return;

    try {
      await updateQuantity(itemId, newQty);
    } catch (err) {
      alert(err.message || 'Failed to update quantity');
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!confirm('Are you sure you want to remove this item from your cart?')) return;
    try {
      await removeFromCart(itemId);
    } catch (err) {
      alert(err.message || 'Failed to remove item');
    }
  };

  const handleClearCart = async () => {
    if (!confirm('Are you sure you want to clear your entire cart?')) return;
    setClearing(true);
    try {
      await clearCart();
    } catch (err) {
      alert(err.message || 'Failed to clear cart');
    } finally {
      setClearing(false);
    }
  };

  const handleCheckout = () => {
    if (!cart?.summary?.isValidForCheckout) return;
    navigate('/checkout');
  };

  const hasItems = cart && Array.isArray(cart.items) && cart.items.length > 0;

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-grow flex flex-col space-y-8 w-full min-w-0 overflow-x-hidden">
        
        {/* Header */}
        <div className="border-b border-menx-border pb-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-menx-primary/10 border border-menx-primary/20 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-menx-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Your Shopping Cart</h1>
              {hasItems && (
                <p className="text-xs text-menx-text-secondary mt-0.5 font-medium">
                  {cart.summary.totalQuantity} {cart.summary.totalQuantity === 1 ? 'item' : 'items'} ({cart.items.length} {cart.items.length === 1 ? 'product' : 'products'})
                </p>
              )}
            </div>
          </div>
          {hasItems && (
            <button
              type="button"
              disabled={clearing}
              onClick={handleClearCart}
              className="text-xs text-menx-text-muted hover:text-menx-error font-semibold transition-colors duration-200 border border-menx-border hover:border-menx-error/30 px-3 py-1.5 rounded-lg disabled:opacity-40"
            >
              {clearing ? 'Clearing...' : 'Clear Cart'}
            </button>
          )}
        </div>

        {/* Loading / Error states */}
        {loading && !cart ? (
          <div className="flex justify-center py-20 flex-grow">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-menx-primary"></div>
          </div>
        ) : error && !cart ? (
          <div className="bg-menx-error/10 border border-menx-error/20 text-menx-error p-6 rounded-xl text-center max-w-lg mx-auto">
            <p>Error retrieving cart details: {error}</p>
          </div>
        ) : !hasItems ? (
          <div className="menx-card p-8 sm:p-12 rounded-2xl text-center text-menx-text-muted space-y-4 max-w-lg mx-auto shadow-xl my-8">
            <div className="w-16 h-16 bg-menx-bg rounded-full flex items-center justify-center mx-auto border border-menx-border">
              <ShoppingBag className="w-8 h-8 text-menx-text-muted" />
            </div>
            <h3 className="text-white text-lg sm:text-xl font-bold tracking-tight">Your Cart is Empty</h3>
            <p className="text-sm text-menx-text-secondary max-w-md mx-auto leading-relaxed">
              Looks like you haven't added any designer items to your cart yet. Explore our curated collections.
            </p>
            <div className="pt-3">
              <Link
                to="/"
                className="inline-flex items-center space-x-2 py-3 px-6 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] font-bold rounded-lg transition-colors duration-200 shadow-lg shadow-menx-primary/10 text-sm"
              >
                <span>Start Shopping</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 xl:gap-10 items-start w-full min-w-0">
            
            {/* Cart Items Catalogue (Responsive 2-Column Grid on sm+) */}
            <div className="lg:col-span-2 space-y-6 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 w-full min-w-0">
                {cart.items.map((item) => (
                  <CartItemCard
                    key={item.id}
                    item={item}
                    isUpdating={isItemUpdating(item.id)}
                    onQuantityChange={handleQuantityChange}
                    onRemoveItem={handleRemoveItem}
                  />
                ))}
              </div>
            </div>

            {/* Price Breakdown Sidebar (Sticky Summary) */}
            <div className="menx-card rounded-2xl p-5 sm:p-6 space-y-6 lg:sticky lg:top-24 shadow-xl min-w-0">
              <h2 className="text-lg font-bold text-white tracking-tight border-b border-menx-border pb-3 flex items-center justify-between">
                <span>Order Summary</span>
                <span className="text-xs font-mono font-normal text-menx-text-secondary">
                  {cart.summary.totalQuantity} {cart.summary.totalQuantity === 1 ? 'item' : 'items'}
                </span>
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-menx-text-secondary">
                  <span>Price ({cart.summary.totalQuantity} items)</span>
                  <span className="font-mono">{formatCurrency(cart.summary.mrpSubtotal)}</span>
                </div>
                
                {cart.summary.totalDiscount > 0 && (
                  <div className="flex justify-between text-menx-success">
                    <span>Discount on MRP</span>
                    <span className="font-mono">-{formatCurrency(cart.summary.totalDiscount)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-menx-text-secondary">
                  <span>Delivery Charges</span>
                  <span className="text-menx-success font-bold">FREE</span>
                </div>

                <div className="border-t border-menx-border pt-4 flex justify-between items-baseline text-base font-extrabold text-white">
                  <span>Total Amount</span>
                  <span className="text-menx-primary text-xl font-mono">{formatCurrency(cart.summary.subtotal)}</span>
                </div>
              </div>

              {/* Checkout button */}
              <button
                type="button"
                disabled={!cart.summary.isValidForCheckout}
                onClick={handleCheckout}
                className="w-full py-3.5 bg-menx-primary hover:bg-menx-primary-hover disabled:bg-menx-surface-elevated disabled:text-menx-text-muted text-[#0B0F14] font-extrabold rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 shadow-lg shadow-menx-primary/10 text-sm"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Invalid checkout warning */}
              {!cart.summary.isValidForCheckout && (
                <div className="text-xs text-menx-error bg-menx-error/10 border border-menx-error/20 p-3 rounded-lg text-center space-y-1">
                  <p className="font-bold flex items-center justify-center">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Checkout Blocked
                  </p>
                  <p className="text-[11px] leading-relaxed text-menx-text-secondary">
                    Some items in your cart are out of stock or have exceeded inventory limits. Please resolve errors to proceed.
                  </p>
                </div>
              )}

              {/* Trust Badges */}
              <div className="border-t border-menx-border pt-4 grid grid-cols-3 gap-2 text-center">
                <div className="flex flex-col items-center space-y-1 p-2 rounded-lg bg-menx-bg/60 border border-menx-border">
                  <ShieldCheck className="w-4 h-4 text-menx-primary" />
                  <span className="text-[10px] text-menx-text-secondary font-medium leading-tight">100% Authentic</span>
                </div>
                <div className="flex flex-col items-center space-y-1 p-2 rounded-lg bg-menx-bg/60 border border-menx-border">
                  <Truck className="w-4 h-4 text-menx-primary" />
                  <span className="text-[10px] text-menx-text-secondary font-medium leading-tight">Free Express Delivery</span>
                </div>
                <div className="flex flex-col items-center space-y-1 p-2 rounded-lg bg-menx-bg/60 border border-menx-border">
                  <RefreshCw className="w-4 h-4 text-menx-primary" />
                  <span className="text-[10px] text-menx-text-secondary font-medium leading-tight">7-Day Easy Returns</span>
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </BaseLayout>
  );
}

