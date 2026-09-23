import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, ShoppingBag, Calendar, Truck, ArrowRight, MapPin, Receipt, Clock } from 'lucide-react';
import { api } from '../utils/api.js';
import BaseLayout from '../components/BaseLayout.jsx';
import { formatCurrency } from '../utils/formatters.js';
import { getCachedColors } from '../utils/metadataCache.js';

export default function OrderSuccess() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [catalogColors, setCatalogColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchOrderDetails() {
      if (!orderId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [res, colsData] = await Promise.all([
          api.get(`/orders/${orderId}`),
          getCachedColors().catch(() => [])
        ]);
        setOrder(res.data);
        if (Array.isArray(colsData) && colsData.length > 0) {
          setCatalogColors(colsData);
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch order confirmation details');
      } finally {
        setLoading(false);
      }
    }

    fetchOrderDetails();
  }, [orderId]);

  if (loading) {
    return (
      <BaseLayout>
        <div className="flex justify-center items-center py-20 sm:py-32 flex-grow px-4 w-full box-border">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-menx-primary"></div>
            <span className="text-sm text-menx-text-secondary font-medium">Fetching order confirmation...</span>
          </div>
        </div>
      </BaseLayout>
    );
  }

  if (error || !order) {
    return (
      <BaseLayout>
        <div className="w-full max-w-md mx-auto my-12 sm:my-20 p-6 sm:p-8 menx-card rounded-2xl text-center space-y-4 shadow-2xl box-border">
          <div className="w-12 h-12 bg-menx-error/10 border border-menx-error/20 text-menx-error rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 rotate-180" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white break-words">Oops! Fetch Failed</h2>
          <p className="text-sm text-menx-text-secondary leading-relaxed break-words">
            {error || 'Unable to retrieve order details. Please verify your internet connection or check your order history.'}
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center space-x-2 py-2.5 px-6 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] text-xs font-extrabold rounded-lg transition-colors"
            >
              <span>Continue Shopping</span>
            </Link>
          </div>
        </div>
      </BaseLayout>
    );
  }

  const { shipping_snapshot: shipping, order_items: items } = order;

  return (
    <BaseLayout>
      <div className="w-full max-w-full px-3 sm:px-6 lg:px-8 py-6 sm:py-12 box-border flex justify-center">
        <div className="w-full max-w-4xl menx-card-elevated rounded-2xl p-4 sm:p-8 md:p-10 space-y-6 sm:space-y-8 shadow-2xl relative overflow-hidden box-border">
          
          {/* Top Gradient Bar */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 sm:w-48 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />
          
          {/* Success Header */}
          <div className="text-center space-y-3 px-2">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-menx-success/10 border border-menx-success/20 text-menx-success rounded-full flex items-center justify-center mx-auto shadow-inner mb-3 sm:mb-4">
              <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white break-words">
              Order Placed Successfully!
            </h2>
            <p className="text-xs sm:text-sm text-menx-text-secondary max-w-md mx-auto leading-relaxed break-words">
              Thank you for shopping with MENX. Your Cash on Delivery order is confirmed and is being packaged for shipment.
            </p>
          </div>

          {/* Order Meta Info Summary Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-5 menx-card rounded-xl text-center text-xs w-full box-border">
            <div className="p-1 sm:p-0">
              <div className="text-menx-text-muted font-bold uppercase tracking-wider text-[11px] sm:text-xs">Order ID</div>
              <div className="text-white font-mono font-bold mt-1 break-all px-1 text-xs">{order.order_number}</div>
            </div>
            <div className="p-1 sm:p-0">
              <div className="text-menx-text-muted font-bold uppercase tracking-wider text-[11px] sm:text-xs">Payment Method</div>
              <div className="text-menx-primary font-bold mt-1 break-words text-xs">Cash on Delivery</div>
            </div>
            <div className="p-1 sm:p-0">
              <div className="text-menx-text-muted font-bold uppercase tracking-wider text-[11px] sm:text-xs">Total Payable</div>
              <div className="text-white font-extrabold mt-1 font-mono text-xs sm:text-sm">{formatCurrency(order.total_payable)}</div>
            </div>
            <div className="p-1 sm:p-0">
              <div className="text-menx-text-muted font-bold uppercase tracking-wider text-[11px] sm:text-xs">Fulfillment Status</div>
              <div className="text-indigo-400 font-bold mt-1 uppercase font-mono text-xs">{order.order_status}</div>
            </div>
          </div>

          {/* Shipping and Shipment Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full box-border">
            
            {/* Shipping Address Snapshot */}
            <div className="menx-card p-4 sm:p-6 rounded-xl space-y-3 sm:space-y-4 w-full box-border">
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center border-b border-menx-border pb-2">
                <MapPin className="w-4 h-4 text-menx-primary mr-2 flex-shrink-0" />
                <span>Delivery Address</span>
              </h3>
              {shipping ? (
                <div className="space-y-1.5 sm:space-y-2 text-xs text-menx-text-secondary leading-relaxed font-medium break-words">
                  <div className="text-sm font-bold text-white flex flex-wrap items-center gap-2">
                    <span className="break-words">{shipping.recipient_name}</span>
                    {shipping.address_type && (
                      <span className="text-[9px] bg-menx-surface-elevated border border-menx-border text-menx-text-secondary px-1.5 py-0.5 rounded font-mono uppercase">
                        {shipping.address_type}
                      </span>
                    )}
                  </div>
                  <div className="break-words">{shipping.address_line1}</div>
                  {shipping.address_line2 && <div className="break-words">{shipping.address_line2}</div>}
                  {shipping.landmark && <div className="text-menx-text-secondary break-words">Near: {shipping.landmark}</div>}
                  <div className="break-words">{shipping.city}, {shipping.state}</div>
                  <div className="font-bold text-menx-primary/90 font-mono">ZIP Code: {shipping.postal_code}</div>
                  <div className="pt-1 text-menx-text-secondary break-all">Phone: {shipping.phone_number}</div>
                </div>
              ) : (
                <div className="text-xs text-menx-text-muted">Address details unavailable.</div>
              )}
            </div>

            {/* Delivery Window Summary */}
            <div className="menx-card p-4 sm:p-6 rounded-xl space-y-3 sm:space-y-4 w-full box-border">
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center border-b border-menx-border pb-2">
                <Truck className="w-4 h-4 text-menx-primary mr-2 flex-shrink-0" />
                <span>Shipment Information</span>
              </h3>
              <div className="space-y-3 sm:space-y-4 text-xs">
                <div className="flex items-start space-x-3">
                  <Clock className="w-4 h-4 text-menx-text-muted mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <h4 className="font-bold text-white">Estimated Delivery Time</h4>
                    <p className="text-menx-text-secondary mt-0.5 leading-relaxed">3 to 5 Business Days</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Calendar className="w-4 h-4 text-menx-text-muted mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <h4 className="font-bold text-white">Courier Dispatch</h4>
                    <p className="text-menx-text-secondary mt-0.5 leading-relaxed">Dispatched within 24 hours from store center</p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Product Items Breakdown */}
          <div className="menx-card rounded-xl p-4 sm:p-5 space-y-4 w-full box-border">
            <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center border-b border-menx-border pb-2">
              <Receipt className="w-4 h-4 text-menx-primary mr-2 flex-shrink-0" />
              <span>Items Ordered</span>
            </h3>
            <div className="divide-y divide-gray-850 space-y-3">
              {items && items.map((item) => {
                const imagesList = item.variant?.product?.images || [];
                const primaryImage = [...imagesList].sort(
                  (a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.display_order - b.display_order
                )[0];

                const rawColor = (item.color_snapshot || '').trim();
                let displayColorName = rawColor;
                let colorHex = '';

                if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(rawColor)) {
                  colorHex = rawColor;
                  const matched = (catalogColors || []).find(c => (c.hex_code || c.hexCode || '').toLowerCase() === rawColor.toLowerCase());
                  if (matched && matched.name) {
                    displayColorName = matched.name;
                  }
                } else if (rawColor) {
                  const matched = (catalogColors || []).find(c => (c.name || '').toLowerCase() === rawColor.toLowerCase());
                  if (matched) {
                    colorHex = matched.hex_code || matched.hexCode || '';
                  }
                }

                return (
                  <div key={item.id} className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-medium">
                    <div className="flex items-center space-x-3 min-w-0">
                      {/* Thumbnail */}
                      <div className="w-14 h-14 bg-menx-bg border border-menx-border rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {primaryImage?.image_url ? (
                          <img src={primaryImage.image_url} alt={item.product_title_snapshot} className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingBag className="w-5 h-5 text-menx-text-muted" />
                        )}
                      </div>
                      {/* Metadata */}
                      <div className="min-w-0 flex-grow">
                        <h4 className="font-bold text-white truncate text-xs sm:text-sm">{item.product_title_snapshot}</h4>
                        <p className="text-[10px] text-menx-text-muted font-mono mt-0.5 break-all">SKU: {item.variant_sku_snapshot}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-menx-text-secondary mt-1">
                          {item.size_snapshot && <span>Size: {item.size_snapshot}</span>}
                          {displayColorName && (
                            <span className="inline-flex items-center gap-1">
                              <span>Color:</span>
                              {colorHex && (
                                <span
                                  className="w-2 h-2 rounded-full inline-block shrink-0 border border-white/20 shadow-sm"
                                  style={{ backgroundColor: colorHex }}
                                  aria-hidden="true"
                                />
                              )}
                              <span>{displayColorName}</span>
                            </span>
                          )}
                          <span>Qty: {item.quantity}</span>
                        </div>
                      </div>
                    </div>
                    {/* Price */}
                    <div className="text-left sm:text-right flex sm:flex-col justify-between items-center sm:items-end pt-1 sm:pt-0 border-t sm:border-t-0 border-menx-border/50 flex-shrink-0">
                      <span className="text-menx-text-secondary text-[10px] sm:text-xs">{formatCurrency(item.unit_price_snapshot)} each</span>
                      <span className="font-extrabold text-menx-primary font-mono text-xs sm:text-sm">{formatCurrency(item.line_total)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center pt-2 sm:pt-4 w-full max-w-md mx-auto">
            <Link
              to={`/orders/${orderId}`}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center space-x-2 py-3 px-5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] font-extrabold text-xs rounded-lg transition-all duration-200 shadow-md shadow-menx-primary/10 uppercase tracking-wider text-center"
            >
              <span>View Order Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              to="/"
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center space-x-2 py-3 px-5 border border-menx-border hover:bg-menx-surface-elevated text-menx-text-secondary hover:text-white font-bold text-xs rounded-lg transition-colors duration-200 uppercase tracking-wider text-center"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Continue Shopping</span>
            </Link>
          </div>

        </div>
      </div>
    </BaseLayout>
  );
}
