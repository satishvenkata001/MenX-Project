import React, { useState } from 'react';
import { useCart } from '../context/CartContext.jsx';
import { ShoppingBag, Trash2, Plus, Minus, AlertTriangle, ArrowRight, Check, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';

export default function Cart() {
  const { cart, loading, error, updateQuantity, removeFromCart, clearCart } = useCart();
  const [updatingId, setUpdatingId] = useState(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const navigate = useNavigate();

  const handleQuantityChange = async (itemId, currentQty, delta, stock) => {
    const newQty = currentQty + delta;
    if (newQty < 1 || newQty > 10 || newQty > stock) return;

    setUpdatingId(itemId);
    try {
      await updateQuantity(itemId, newQty);
    } catch (err) {
      alert(err.message || 'Failed to update quantity');
    } finally {
      setUpdatingId(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!confirm('Are you sure you want to remove this item from your cart?')) return;
    setUpdatingId(itemId);
    try {
      await removeFromCart(itemId);
    } catch (err) {
      alert(err.message || 'Failed to remove item');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleClearCart = async () => {
    if (!confirm('Are you sure you want to clear your entire cart?')) return;
    try {
      await clearCart();
    } catch (err) {
      alert(err.message || 'Failed to clear cart');
    }
  };

  const handleCheckout = () => {
    if (!cart?.summary?.isValidForCheckout) return;
    setCheckoutSuccess(true);
    setTimeout(() => {
      setCheckoutSuccess(false);
      alert('Checkout process initiated! In a production app, you would proceed to payment and address entry here.');
    }, 2000);
  };

  const hasItems = cart && cart.items && cart.items.length > 0;

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow flex flex-col space-y-8">
        
        {/* Header */}
        <div className="border-b border-gray-800 pb-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-8 h-8 text-amber-500" />
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Your Shopping Cart</h1>
          </div>
          {hasItems && (
            <button
              onClick={handleClearCart}
              className="text-xs text-gray-500 hover:text-red-400 font-semibold transition-colors duration-200"
            >
              Clear Cart
            </button>
          )}
        </div>

        {/* Loading / Error states */}
        {loading && !cart ? (
          <div className="flex justify-center py-20 flex-grow">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
          </div>
        ) : error && !cart ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-xl text-center">
            <p>Error retrieving cart details: {error}</p>
          </div>
        ) : !hasItems ? (
          <div className="bg-gray-900 border border-gray-850 p-12 rounded-xl text-center text-gray-500 space-y-4 max-w-lg mx-auto shadow-lg my-12">
            <div className="w-16 h-16 bg-gray-950 rounded-full flex items-center justify-center mx-auto border border-gray-800">
              <ShoppingBag className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-white text-lg font-bold tracking-tight">Your Cart is Empty</h3>
            <p className="text-sm text-gray-400">
              Looks like you haven't added any designer items to your cart yet. Explore our curated collections.
            </p>
            <div className="pt-2">
              <Link
                to="/"
                className="inline-flex items-center space-x-2 py-3 px-6 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition-colors duration-200 shadow-md shadow-amber-500/10"
              >
                <span>Continue Shopping</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
            
            {/* Cart Items List */}
            <div className="lg:col-span-2 space-y-6">
              {cart.items.map((item) => {
                const isItemUpdating = updatingId === item.id;
                
                return (
                  <div
                    key={item.id}
                    className={`bg-gray-900 border rounded-xl p-5 flex flex-col sm:flex-row gap-5 transition-all duration-200 relative ${
                      !item.isAvailable
                        ? 'border-red-500/20 bg-red-950/5'
                        : 'border-gray-850 hover:border-gray-800'
                    }`}
                  >
                    {/* Thumbnail Image */}
                    <div className="w-full sm:w-28 h-28 bg-gray-950 border border-gray-850 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.productTitle}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="w-8 h-8 text-gray-800" />
                      )}
                      
                      {/* Invalid item block */}
                      {!item.isAvailable && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                      )}
                    </div>

                    {/* Metadata & Actions */}
                    <div className="flex-grow flex flex-col justify-between space-y-4">
                      
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold font-mono tracking-wider text-amber-500 uppercase">
                            {item.sku ? 'MENX' : 'BRAND'}
                          </div>
                          <Link
                            to={`/products/${item.productSlug}`}
                            className="font-bold text-white hover:text-amber-500 transition-colors text-base line-clamp-1"
                          >
                            {item.productTitle}
                          </Link>
                          <div className="flex flex-wrap gap-2 text-xs text-gray-400 font-medium">
                            {item.color && (
                              <span className="bg-gray-950 border border-gray-850 px-2 py-0.5 rounded">
                                Color: {item.color}
                              </span>
                            )}
                            {item.size && (
                              <span className="bg-gray-950 border border-gray-850 px-2 py-0.5 rounded">
                                Size: {item.size}
                              </span>
                            )}
                            {item.outfit && (
                              <span className="bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2 py-0.5 rounded flex items-center">
                                <Sparkles className="w-3 h-3 mr-1" />
                                {item.outfit.title}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Remove Action */}
                        <button
                          disabled={isItemUpdating}
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 rounded-lg border border-gray-800 text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Stock Alert Messages */}
                      {!item.isAvailable && (
                        <div className="text-xs bg-red-500/10 border border-red-500/20 text-red-400 p-2 rounded-lg flex items-center space-x-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>
                            {item.availableStock === 0
                              ? 'Out of stock. Please remove this variant to proceed.'
                              : `Requested quantity exceeds available stock (Only ${item.availableStock} available).`}
                          </span>
                        </div>
                      )}
                      
                      {item.isAvailable && item.availableStock < 5 && (
                        <div className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 p-2 rounded-lg flex items-center space-x-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Only {item.availableStock} left in stock. Order soon!</span>
                        </div>
                      )}

                      {/* Price, Total and Quantity Control */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-gray-850">
                        {/* Unit & Line Pricing */}
                        <div className="flex items-baseline space-x-2">
                          <span className="text-sm font-bold text-gray-200">
                            ₹{item.unitPrice}
                          </span>
                          {item.mrp > item.unitPrice && (
                            <span className="text-xs text-gray-500 line-through">
                              ₹{item.mrp}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 ml-2 font-mono">
                            (Total: ₹{item.lineTotal})
                          </span>
                        </div>

                        {/* Quantity management */}
                        <div className="flex items-center space-x-3">
                          <button
                            disabled={item.quantity <= 1 || isItemUpdating}
                            onClick={() => handleQuantityChange(item.id, item.quantity, -1, item.availableStock)}
                            className="w-8 h-8 rounded-lg border border-gray-850 bg-gray-950 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-40 disabled:hover:text-gray-400 transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          
                          <span className="w-6 text-center font-bold text-sm text-white font-mono">
                            {item.quantity}
                          </span>
                          
                          <button
                            disabled={item.quantity >= 10 || item.quantity >= item.availableStock || isItemUpdating}
                            onClick={() => handleQuantityChange(item.id, item.quantity, 1, item.availableStock)}
                            className="w-8 h-8 rounded-lg border border-gray-850 bg-gray-950 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-40 disabled:hover:text-gray-400 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>

            {/* Price Breakdown Sidebar (Sticky Summary) */}
            <div className="bg-gray-900 border border-gray-850 rounded-xl p-6 space-y-6 lg:sticky lg:top-24 shadow-md">
              <h2 className="text-lg font-bold text-white tracking-tight border-b border-gray-800 pb-3">Order Summary</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Price ({cart.summary.totalQuantity} items)</span>
                  <span>₹{cart.summary.mrpSubtotal}</span>
                </div>
                
                {cart.summary.totalDiscount > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Discount on MRP</span>
                    <span>-₹{cart.summary.totalDiscount}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-gray-400">
                  <span>Delivery Charges</span>
                  <span className="text-green-400 font-bold">FREE</span>
                </div>

                <div className="border-t border-gray-800 pt-4 flex justify-between text-base font-extrabold text-white">
                  <span>Total Amount</span>
                  <span className="text-amber-500">₹{cart.summary.subtotal}</span>
                </div>
              </div>

              {/* Checkout success block */}
              {checkoutSuccess ? (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-lg flex items-center justify-center space-x-2 text-sm font-semibold">
                  <Check className="w-4 h-4 animate-bounce" />
                  <span>Processing Checkout...</span>
                </div>
              ) : (
                <button
                  disabled={!cart.summary.isValidForCheckout}
                  onClick={handleCheckout}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-800 disabled:text-gray-500 text-black font-bold rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/5 text-sm"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {/* Invalid checkout warning */}
              {!cart.summary.isValidForCheckout && (
                <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/10 p-3 rounded-lg text-center space-y-1">
                  <p className="font-bold flex items-center justify-center">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Checkout Blocked
                  </p>
                  <p className="text-[11px] leading-relaxed text-gray-400">
                    Some items in your cart are out of stock or have exceeded inventory limits. Please resolve errors to proceed.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </BaseLayout>
  );
}
