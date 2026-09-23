import React, { useEffect, useState } from 'react';
import { Package, Calendar, ArrowRight, ShoppingBag, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';
import { formatCurrency } from '../utils/formatters.js';
import { getCachedOrders, getMemoryCachedOrders } from '../utils/metadataCache.js';

export default function OrderHistory() {
  const cachedOrders = getMemoryCachedOrders();
  const [orders, setOrders] = useState(cachedOrders || []);
  const [loading, setLoading] = useState(!cachedOrders);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadOrders() {
      if (!cachedOrders) {
        setLoading(true);
      }
      setError(null);
      try {
        const list = await getCachedOrders();
        if (isMounted) {
          setOrders(list || []);
        }
      } catch (err) {
        console.error('Failed to load orders:', err.message);
        if (isMounted && !cachedOrders) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadOrders();
    return () => { isMounted = false; };
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-menx-warning/10 border-menx-warning/20 text-menx-warning';
      case 'CONFIRMED':
        return 'bg-menx-info/10 border-menx-info/20 text-menx-info';
      case 'PACKED':
        return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
      case 'SHIPPED':
        return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
      case 'OUT_FOR_DELIVERY':
        return 'bg-menx-primary/10 border-menx-primary/20 text-menx-primary';
      case 'DELIVERED':
        return 'bg-menx-success/10 border-menx-success/20 text-menx-success';
      case 'CANCELLED':
        return 'bg-menx-error/10 border-menx-error/20 text-menx-error';
      case 'RETURN_REQUESTED':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'RETURNED':
        return 'bg-teal-500/10 border-teal-500/20 text-teal-400';
      default:
        return 'bg-gray-500/10 border-menx-border text-menx-text-secondary';
    }
  };

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-grow space-y-6 sm:space-y-8">
        
        {/* Header */}
        <div className="border-b border-menx-border pb-5 sm:pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-menx-primary/10 border border-menx-primary/20 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-menx-primary" />
              </div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">My Orders</h1>
                {orders.length > 0 && (
                  <span className="text-xs font-bold font-mono text-menx-primary bg-menx-primary/10 border border-menx-primary/20 px-2.5 py-0.5 rounded-full">
                    {orders.length} {orders.length === 1 ? 'order' : 'orders'}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs sm:text-sm text-menx-text-secondary pl-13">
              Track, manage and view all your orders.
            </p>
          </div>
        </div>

        {/* Loading / Error / Empty States */}
        {loading && orders.length === 0 ? (
          <div className="space-y-4 sm:space-y-6">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-menx-surface border border-menx-border rounded-2xl p-5 sm:p-6 space-y-4 animate-pulse"
              >
                <div className="flex justify-between items-center pb-3 border-b border-menx-border/60">
                  <div className="h-4 bg-menx-surface-elevated rounded w-48" />
                  <div className="h-6 bg-menx-surface-elevated rounded w-20" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="w-[76px] h-[92px] sm:w-[92px] sm:h-[110px] bg-menx-surface-elevated rounded-xl" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-menx-surface-elevated rounded w-3/4" />
                      <div className="h-3 bg-menx-surface-elevated rounded w-1/2" />
                      <div className="h-3 bg-menx-surface-elevated rounded w-1/4" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-5 bg-menx-surface-elevated rounded w-24" />
                    <div className="h-9 bg-menx-surface-elevated rounded-xl w-28" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-menx-error/10 border border-menx-error/20 text-menx-error p-6 rounded-2xl text-center space-y-2 max-w-lg mx-auto shadow-lg">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="font-bold text-sm">Failed to load order history</p>
            <p className="text-xs text-menx-text-secondary">{error}</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="menx-card p-8 sm:p-12 rounded-2xl text-center text-menx-text-muted space-y-4 max-w-md mx-auto shadow-xl my-12">
            <div className="w-16 h-16 bg-menx-bg rounded-2xl flex items-center justify-center mx-auto border border-menx-border text-menx-primary">
              <Package className="w-8 h-8 text-menx-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-white text-lg font-bold tracking-tight">No orders yet</h3>
              <p className="text-xs sm:text-sm text-menx-text-secondary">
                Your purchases will appear here.
              </p>
            </div>
            <div className="pt-2">
              <Link
                to="/"
                className="inline-flex items-center space-x-2 py-3 px-6 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] font-bold rounded-xl text-sm transition-colors shadow-md shadow-menx-primary/20"
              >
                <span>Start Shopping</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {orders.map((order) => {
              const items = order.order_items || [];
              const primaryItem = items[0];
              const extraItemsCount = items.length > 1 ? items.length - 1 : 0;

              // Resolve product image for primary item
              const imagesList = primaryItem?.variant?.product?.images || [];
              const primaryImage = [...imagesList].sort(
                (a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.display_order ?? 0) - (b.display_order ?? 0)
              )[0];
              const imageUrl = primaryImage?.image_url;

              // Resolve clean color name
              const rawColor = (primaryItem?.color_snapshot || '').trim();
              const displayColorName = rawColor ? rawColor.replace(/-\d{10,}$/, '').trim() : '';

              // Resolve product title
              const productTitle = primaryItem?.product_title_snapshot || primaryItem?.variant?.product?.title || 'Ordered Items';

              return (
                <div
                  key={order.id}
                  className="menx-card rounded-2xl p-4 sm:p-6 shadow-xl transition-all duration-200 flex flex-col space-y-4 w-full max-w-full overflow-hidden hover:border-menx-primary/30"
                >
                  {/* Card Top Metadata Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-menx-border/60">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="text-xs sm:text-sm font-mono font-bold text-white tracking-wide break-all">
                        ORDER #{order.order_number}
                      </span>
                      <span className="text-menx-text-muted hidden sm:inline">•</span>
                      <div className="flex items-center space-x-1.5 text-xs text-menx-text-secondary">
                        <Calendar className="w-3.5 h-3.5 text-menx-text-muted shrink-0" />
                        <span>Placed on {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                      <span className="text-menx-text-muted hidden sm:inline">•</span>
                      <span className="text-[11px] font-semibold text-menx-text-secondary uppercase">
                        {order.payment_method === 'COD' ? 'COD' : order.payment_method}
                        {order.payment_status === 'PAID' || order.payment_status === 'COLLECTED' ? ' • PAID' : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-md border uppercase tracking-wider ${getStatusBadge(order.order_status)}`}>
                        {order.order_status}
                      </span>
                    </div>
                  </div>

                  {/* Card Middle: Product Item Details + Total & Action */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-5 pt-1">
                    
                    {/* Left: Product Thumbnail + Details */}
                    <div className="flex items-start space-x-3.5 sm:space-x-4 min-w-0 flex-1">
                      {/* Product Image Thumbnail */}
                      <div className="w-[76px] h-[92px] sm:w-[92px] sm:h-[110px] bg-[#0B0F14]/90 border border-menx-border rounded-xl overflow-hidden shrink-0 flex items-center justify-center relative shadow-inner">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={productTitle}
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              const fallback = e.target.parentElement?.querySelector('.fallback-icon');
                              if (fallback) fallback.style.display = 'flex';
                            }}
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                        <div className={`fallback-icon w-full h-full flex flex-col items-center justify-center text-menx-border space-y-1 ${imageUrl ? 'hidden' : 'flex'}`}>
                          <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7 text-menx-text-muted/50" />
                          <span className="text-[8px] sm:text-[9px] uppercase font-mono tracking-wider text-menx-text-muted/60">MENX</span>
                        </div>
                      </div>

                      {/* Product Information */}
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <h3 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug line-clamp-2">
                          {productTitle}
                        </h3>

                        {primaryItem ? (
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-menx-text-secondary">
                            {primaryItem.size_snapshot && (
                              <span>Size: <strong className="text-white font-semibold">{primaryItem.size_snapshot}</strong></span>
                            )}
                            {primaryItem.size_snapshot && displayColorName && <span className="text-menx-text-muted/60">|</span>}
                            {displayColorName && (
                              <span>Color: <strong className="text-white font-semibold">{displayColorName}</strong></span>
                            )}
                            {(primaryItem.size_snapshot || displayColorName) && <span className="text-menx-text-muted/60">|</span>}
                            <span>Qty: <strong className="text-white font-semibold">{primaryItem.quantity}</strong></span>
                          </div>
                        ) : (
                          <p className="text-xs text-menx-text-secondary">Standard delivery order</p>
                        )}

                        {/* Product price snapshot if available */}
                        {primaryItem?.unit_price_snapshot && (
                          <div className="text-xs sm:text-sm font-bold text-menx-text-secondary pt-0.5">
                            {formatCurrency(primaryItem.unit_price_snapshot)}
                          </div>
                        )}

                        {/* Multi-item badge indicator */}
                        {extraItemsCount > 0 && (
                          <div className="pt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-menx-surface-elevated text-menx-primary border border-menx-border">
                              +{extraItemsCount} more {extraItemsCount === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right / Bottom on Mobile: Total & Action */}
                    <div className="flex items-center justify-between md:flex-col md:items-end md:justify-center gap-3 md:gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-menx-border/60 shrink-0">
                      <div className="text-left md:text-right">
                        <div className="text-[10px] text-menx-text-muted uppercase tracking-wider font-bold">Total Amount</div>
                        <div className="text-base sm:text-xl font-black text-menx-primary font-mono">{formatCurrency(order.total_payable)}</div>
                      </div>

                      <Link
                        to={`/orders/${order.id}`}
                        className="inline-flex items-center justify-center space-x-1.5 py-2.5 px-4 sm:px-5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] font-bold rounded-xl text-xs sm:text-sm transition-all duration-200 shadow-md shrink-0"
                      >
                        <span>View Details</span>
                        <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </Link>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </BaseLayout>
  );
}
