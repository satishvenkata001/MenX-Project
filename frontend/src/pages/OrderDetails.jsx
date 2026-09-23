import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api.js';
import { 
  Package, Calendar, MapPin, Truck, HelpCircle, ArrowLeft, ArrowRight, 
  Check, AlertTriangle, Clock, X, ShoppingBag, ShieldCheck, XCircle, RotateCcw
} from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';
import Modal from '../components/Modal.jsx';
import { formatCurrency } from '../utils/formatters.js';
import { getCachedColors } from '../utils/metadataCache.js';

function OrderItemCard({ item, colors = [] }) {
  const [imgError, setImgError] = useState(false);
  const product = item.variant?.product;
  const brandName = product?.brand?.name;
  const categoryName = product?.category?.name;
  const subcategoryName = product?.subcategory?.name;
  const categoryPath = [categoryName, subcategoryName].filter(Boolean).join(' / ');

  const imagesList = product?.images || [];
  const primaryImage = [...imagesList].sort(
    (a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.display_order ?? 0) - (b.display_order ?? 0)
  )[0];
  const imageUrl = primaryImage?.image_url;

  const isAvailable = product && product.status === 'PUBLISHED' && product.slug;
  const hasDiscount = Number(item.unit_mrp_snapshot) > Number(item.unit_price_snapshot);

  // Color name & swatch resolution from order snapshot
  const rawColor = (item.color_snapshot || '').trim();
  let cleanColorName = rawColor.replace(/-\d{10,}$/, '').trim();
  let colorHex = '';

  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(cleanColorName)) {
    colorHex = cleanColorName;
    const matched = (colors || []).find(c => (c.hex_code || c.hexCode || '').toLowerCase() === cleanColorName.toLowerCase());
    if (matched && matched.name) {
      cleanColorName = matched.name;
    }
  } else if (cleanColorName) {
    const matched = (colors || []).find(c => (c.name || '').toLowerCase() === cleanColorName.toLowerCase());
    if (matched) {
      colorHex = matched.hex_code || matched.hexCode || '';
    }
  }

  const productTitle = item.product_title_snapshot || product?.title || 'Purchased Item';

  return (
    <div className="group menx-card hover:border-menx-primary/40 rounded-xl p-3 sm:p-4 transition-all duration-200 flex items-start space-x-3.5 sm:space-x-4 w-full max-w-full overflow-hidden shadow-sm hover:shadow-md">
      {/* LEFT: Compact Product Thumbnail */}
      <div className="w-[82px] sm:w-[104px] aspect-[82/100] sm:aspect-[104/120] bg-[#0B0F14]/95 border border-menx-border/80 rounded-xl overflow-hidden shrink-0 flex items-center justify-center relative shadow-inner">
        {imageUrl && !imgError ? (
          <img
            src={imageUrl}
            alt={productTitle}
            width="104"
            height="120"
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-menx-border space-y-1">
            <ShoppingBag className="w-6 h-6 text-menx-text-muted/50" />
            <span className="text-[8px] uppercase font-mono tracking-wider text-menx-text-muted/60">MENX</span>
          </div>
        )}
      </div>

      {/* RIGHT: Product Information with strict hierarchy */}
      <div className="flex-1 min-w-0 space-y-1 self-center sm:self-auto py-0.5">
        {/* Brand */}
        {brandName && (
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-menx-primary leading-none">
            {brandName}
          </div>
        )}

        {/* Product Title */}
        <h4 className="font-bold text-white text-sm sm:text-base leading-snug tracking-tight line-clamp-2">
          {productTitle}
        </h4>

        {/* Category Breadcrumb */}
        {categoryPath && (
          <p className="text-[11px] sm:text-xs text-menx-text-secondary font-medium leading-tight truncate">
            {categoryPath}
          </p>
        )}

        {/* Compact Variant Metadata: Size L • ● Navy Blue • Qty 1 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-menx-text-secondary pt-0.5">
          {item.size_snapshot && (
            <span>Size <strong className="text-white font-semibold">{item.size_snapshot}</strong></span>
          )}
          {item.size_snapshot && (cleanColorName || item.quantity) && (
            <span className="text-menx-text-muted/60">•</span>
          )}
          {cleanColorName && (
            <span className="inline-flex items-center gap-1.5">
              {colorHex && (
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block shrink-0 border border-white/20 shadow-sm"
                  style={{ backgroundColor: colorHex }}
                  aria-hidden="true"
                />
              )}
              <strong className="text-white font-semibold">{cleanColorName}</strong>
            </span>
          )}
          {cleanColorName && item.quantity && (
            <span className="text-menx-text-muted/60">•</span>
          )}
          <span>Qty <strong className="text-white font-semibold">{item.quantity}</strong></span>
        </div>

        {/* Price Presentation: ₹499   MRP ₹999 • Item Total: ₹499 */}
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-xs pt-0.5">
          <span className="text-sm sm:text-base font-black text-white font-mono">
            {formatCurrency(item.unit_price_snapshot)}
          </span>
          {hasDiscount && (
            <span className="text-[11px] text-menx-text-muted line-through font-mono">
              MRP {formatCurrency(item.unit_mrp_snapshot)}
            </span>
          )}
          <span className="text-menx-text-muted/50 hidden sm:inline">•</span>
          <span className="text-[11px] sm:text-xs text-menx-text-secondary">
            Item Total: <strong className="text-menx-primary font-bold font-mono">{formatCurrency(item.line_total)}</strong>
          </span>
        </div>

        {/* View Product Action */}
        <div className="pt-0.5">
          {isAvailable ? (
            <Link
              to={`/products/${product.slug}`}
              className="inline-flex items-center space-x-1 text-[11px] sm:text-xs font-bold text-menx-primary hover:text-menx-primary uppercase tracking-wider transition-colors group/link"
            >
              <span>VIEW PRODUCT</span>
              <ArrowRight className="w-3.5 h-3.5 transform group-hover/link:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <span className="text-[11px] text-menx-text-muted italic">
              Product currently unavailable
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function buildTimelineSteps(order, statusHistory = []) {
  if (!order) return [];

  const getEvent = (status) => statusHistory.find(h => h.to_status === status);

  const isCancelled = order.order_status === 'CANCELLED';
  const isReturnRequested = order.order_status === 'RETURN_REQUESTED';
  const isReturned = order.order_status === 'RETURNED';

  const standardFlow = [
    {
      key: 'PENDING',
      title: 'Order Placed',
      description: 'Your order has been placed successfully and is being processed.',
      timestamp: order.created_at,
    },
    {
      key: 'CONFIRMED',
      title: 'Order Confirmed',
      description: 'Your order has been confirmed by our fulfillment team.',
      timestamp: getEvent('CONFIRMED')?.created_at,
    },
    {
      key: 'PACKED',
      title: 'Items Packed',
      description: 'Your items have been carefully inspected and packed.',
      timestamp: getEvent('PACKED')?.created_at,
    },
    {
      key: 'SHIPPED',
      title: 'Shipped',
      description: order.courier_partner
        ? `Package in transit with ${order.courier_partner}${order.tracking_number ? ` (AWB: ${order.tracking_number})` : ''}.`
        : 'Your package has been shipped and is in transit.',
      timestamp: getEvent('SHIPPED')?.created_at,
    },
    {
      key: 'OUT_FOR_DELIVERY',
      title: 'Out for Delivery',
      description: 'Your order is out for delivery and will arrive shortly.',
      timestamp: getEvent('OUT_FOR_DELIVERY')?.created_at,
    },
    {
      key: 'DELIVERED',
      title: 'Delivered',
      description: 'Package delivered to the shipping address.',
      timestamp: getEvent('DELIVERED')?.created_at,
    }
  ];

  if (isCancelled) {
    const cancelEvent = getEvent('CANCELLED');
    const wasConfirmed = getEvent('CONFIRMED');
    const steps = [
      standardFlow[0],
      ...(wasConfirmed ? [standardFlow[1]] : []),
      {
        key: 'CANCELLED',
        title: 'Order Cancelled',
        description: order.cancelled_reason
          ? `Reason: ${order.cancelled_reason}`
          : 'This order was cancelled and inventory has been returned to stock.',
        timestamp: cancelEvent?.created_at || order.updated_at,
        isTerminalCancelled: true
      }
    ];
    return steps.map((s, idx) => ({
      ...s,
      state: idx === steps.length - 1 ? 'cancelled' : 'completed'
    }));
  }

  if (isReturnRequested || isReturned) {
    const returnSteps = [
      ...standardFlow,
      {
        key: 'RETURN_REQUESTED',
        title: 'Return Requested',
        description: 'A return or exchange request was submitted for this order.',
        timestamp: getEvent('RETURN_REQUESTED')?.created_at || order.updated_at,
      }
    ];
    if (isReturned) {
      returnSteps.push({
        key: 'RETURNED',
        title: 'Returned & Processed',
        description: 'Returned items received at the warehouse and finalized.',
        timestamp: getEvent('RETURNED')?.created_at || order.updated_at,
      });
    }

    const currentIdx = returnSteps.findIndex(s => s.key === order.order_status);
    return returnSteps.map((s, idx) => ({
      ...s,
      state: idx < currentIdx ? 'completed' : idx === currentIdx ? 'current' : 'upcoming'
    }));
  }

  const orderStatusHierarchy = ['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  const currentIdx = orderStatusHierarchy.indexOf(order.order_status);

  return standardFlow.map((s, idx) => {
    let state = 'upcoming';
    if (idx < currentIdx) {
      state = 'completed';
    } else if (idx === currentIdx) {
      state = 'current';
    } else {
      state = 'upcoming';
    }
    return {
      ...s,
      state
    };
  });
}

export default function OrderDetails() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [catalogColors, setCatalogColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cancellation States
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [selectedReasonOpt, setSelectedReasonOpt] = useState('Changed my mind');
  const [customReasonText, setCustomReasonText] = useState('');
  const [cancelError, setCancelError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Load details and status history
  async function loadOrderDetails() {
    setLoading(true);
    setError(null);
    try {
      const [detailsRes, historyRes, colsData] = await Promise.all([
        api.get(`/orders/${orderId}`),
        api.get(`/orders/${orderId}/status-history`),
        getCachedColors().catch(() => [])
      ]);
      setOrder(detailsRes.data);
      setStatusHistory(historyRes.data || []);
      if (Array.isArray(colsData) && colsData.length > 0) {
        setCatalogColors(colsData);
      }
    } catch (err) {
      console.error('Failed to load order details:', err.message);
      const msg = err.response?.data?.message || err.message || 'Failed to load order details';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrderDetails();
  }, [orderId]);

  const handleCancelOrder = async (e) => {
    e.preventDefault();
    const reasonToSend = selectedReasonOpt === 'Other' ? customReasonText : selectedReasonOpt;
    if (!reasonToSend.trim()) {
      setCancelError('Please specify a cancellation reason.');
      return;
    }

    setCancelling(true);
    setCancelError(null);
    try {
      await api.post(`/orders/${orderId}/cancel`, { reason: reasonToSend });
      setShowCancelModal(false);
      setSelectedReasonOpt('Changed my mind');
      setCustomReasonText('');
      setSuccessMessage('Order cancelled successfully.');
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      await loadOrderDetails();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to cancel order';
      setCancelError(msg);
    } finally {
      setCancelling(false);
    }
  };

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

  const isCancelable = order && ['PENDING', 'CONFIRMED'].includes(order.order_status);
  const timelineSteps = buildTimelineSteps(order, statusHistory);

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-grow space-y-6 sm:space-y-8">
        
        {/* Back Navigation & Breadcrumb */}
        <div>
          <Link
            to="/orders"
            className="inline-flex items-center space-x-1.5 text-xs sm:text-sm font-semibold text-menx-text-secondary hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" />
            <span>Back to orders</span>
          </Link>
        </div>

        {/* Global Toast Success Notification */}
        {successMessage && (
          <div className="bg-menx-success/10 border border-menx-success/20 text-menx-success p-4 rounded-xl flex items-center justify-between shadow-md">
            <div className="flex items-center space-x-2.5">
              <Check className="w-5 h-5 text-menx-success shrink-0" />
              <span className="text-sm font-medium">{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-menx-success hover:text-green-300 text-xs font-bold uppercase tracking-wider ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading / Error States */}
        {loading && !order ? (
          <div className="space-y-6 animate-pulse">
            <div className="bg-menx-surface border border-menx-border rounded-2xl p-6 h-28" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-menx-surface border border-menx-border rounded-2xl p-6 h-80" />
                <div className="bg-menx-surface border border-menx-border rounded-2xl p-6 h-60" />
              </div>
              <div className="space-y-6">
                <div className="bg-menx-surface border border-menx-border rounded-2xl p-6 h-48" />
                <div className="bg-menx-surface border border-menx-border rounded-2xl p-6 h-48" />
              </div>
            </div>
          </div>
        ) : error || !order ? (
          <div className="bg-menx-error/10 border border-menx-error/20 text-menx-error p-8 rounded-2xl text-center space-y-3 max-w-md mx-auto shadow-xl my-12">
            <AlertTriangle className="w-10 h-10 mx-auto text-menx-error" />
            <h3 className="font-bold text-base text-white">Unable to load order details</h3>
            <p className="text-xs text-menx-text-secondary">{error || 'Order not found'}</p>
            <div className="pt-2">
              <Link
                to="/orders"
                className="inline-flex items-center space-x-2 py-2.5 px-5 bg-menx-surface border border-menx-border text-white text-xs font-bold rounded-xl hover:bg-menx-surface-elevated transition-colors"
              >
                <span>Return to Orders List</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            
            {/* Page Header Card */}
            <div className="bg-menx-surface border border-menx-border rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-menx-primary/10 border border-menx-primary/20 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-menx-primary" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-menx-text-muted uppercase tracking-wider">Order Details</span>
                    <h1 className="text-lg sm:text-2xl font-black text-white font-mono tracking-tight break-all">
                      #{order.order_number}
                    </h1>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-menx-text-secondary pl-13">
                  <span className="flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-menx-text-muted" />
                    <span>Placed on {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                  <span className="hidden sm:inline text-menx-text-muted">•</span>
                  <span className="font-semibold uppercase tracking-wider text-[11px]">
                    {order.payment_method === 'COD' ? 'Cash on Delivery (COD)' : order.payment_method}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-auto shrink-0 pl-13 sm:pl-0">
                <span className={`text-xs sm:text-sm font-bold px-3 py-1.5 rounded-lg border uppercase tracking-wider shadow-sm ${getStatusBadge(order.order_status)}`}>
                  {order.order_status}
                </span>
              </div>
            </div>

            {/* Cancelled Order Notice */}
            {order.order_status === 'CANCELLED' && (
              <div className="bg-red-500/10 border border-menx-error/25 text-menx-error p-5 rounded-2xl flex items-start space-x-3.5 shadow-md">
                <XCircle className="w-5 h-5 mt-0.5 text-menx-error shrink-0" />
                <div className="space-y-1 text-sm">
                  <h4 className="font-bold text-white">This Order was Cancelled</h4>
                  <p className="text-xs text-menx-text-secondary leading-relaxed">
                    {order.cancelled_reason ? (
                      <span>Reason provided: <strong className="text-white">{order.cancelled_reason}</strong>. </span>
                    ) : null}
                    All reserved product inventory has been restored to catalog availability.
                  </p>
                </div>
              </div>
            )}

            {/* Main Content 2-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
              
              {/* Left Column (2 Cols): Timeline & Ordered Products */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* 1. ORDER STATUS TIMELINE (Primary UX Feature) */}
                <div className="menx-card rounded-2xl p-5 sm:p-7 shadow-xl space-y-6">
                  <div className="border-b border-menx-border/70 pb-4 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <Clock className="w-5 h-5 text-menx-primary" />
                      <h2 className="text-base sm:text-lg font-extrabold text-white">Order Status & Tracking</h2>
                    </div>
                    {order.tracking_number && (
                      <span className="text-xs font-mono font-bold text-menx-primary bg-menx-primary/10 border border-menx-primary/20 px-2.5 py-1 rounded-md">
                        AWB: {order.tracking_number}
                      </span>
                    )}
                  </div>

                  {/* Vertical Timeline */}
                  <div className="relative pl-2 sm:pl-4 py-2">
                    <div className="space-y-8 relative">
                      {timelineSteps.map((step, idx) => {
                        const isLast = idx === timelineSteps.length - 1;
                        const isCompleted = step.state === 'completed';
                        const isCurrent = step.state === 'current';
                        const isCancelled = step.state === 'cancelled';
                        const isUpcoming = step.state === 'upcoming';

                        return (
                          <div key={step.key} className="relative flex items-start space-x-4 sm:space-x-5 group">
                            
                            {/* Vertical Connecting Line */}
                            {!isLast && (
                              <div
                                className={`absolute left-4 top-8 -bottom-8 w-0.5 transition-colors ${
                                  isCompleted
                                    ? 'bg-menx-success/60'
                                    : isCurrent
                                    ? 'bg-menx-primary/40 border-l border-dashed border-menx-primary/40'
                                    : 'border-l border-dashed border-menx-border/70'
                                }`}
                                aria-hidden="true"
                              />
                            )}

                            {/* Node Icon */}
                            <div className="relative z-10 shrink-0">
                              {isCompleted ? (
                                <div className="w-8 h-8 rounded-full bg-menx-success/15 border-2 border-menx-success text-menx-success flex items-center justify-center shadow-md shadow-menx-success/10">
                                  <Check className="w-4 h-4 stroke-[3]" />
                                </div>
                              ) : isCurrent ? (
                                <div className="w-8 h-8 rounded-full bg-menx-primary border-2 border-amber-300 text-[#0B0F14] flex items-center justify-center shadow-lg shadow-menx-primary/25 ring-4 ring-menx-primary/20 animate-pulse">
                                  <div className="w-2.5 h-2.5 rounded-full bg-[#0B0F14]" />
                                </div>
                              ) : isCancelled ? (
                                <div className="w-8 h-8 rounded-full bg-menx-error/15 border-2 border-menx-error text-menx-error flex items-center justify-center shadow-md shadow-menx-error/10">
                                  <X className="w-4 h-4 stroke-[3]" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-menx-bg border border-menx-border text-menx-text-muted flex items-center justify-center">
                                  <div className="w-2 h-2 rounded-full bg-menx-border" />
                                </div>
                              )}
                            </div>

                            {/* Step Text Details */}
                            <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <h3 className={`text-sm sm:text-base font-bold tracking-tight ${
                                  isCurrent ? 'text-menx-primary font-extrabold' : isCompleted ? 'text-white' : isCancelled ? 'text-menx-error' : 'text-menx-text-muted'
                                }`}>
                                  {step.title}
                                </h3>
                                
                                {step.timestamp && (
                                  <span className="text-[11px] sm:text-xs text-menx-text-muted font-mono font-medium">
                                    {new Date(step.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>

                              <p className={`text-xs sm:text-sm leading-relaxed ${
                                isCurrent ? 'text-menx-text font-medium' : isUpcoming ? 'text-menx-text-muted/70' : 'text-menx-text-secondary'
                              }`}>
                                {step.description}
                              </p>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 2. ORDERED ITEMS SECTION */}
                <div className="menx-card rounded-2xl p-5 sm:p-7 shadow-xl space-y-5">
                  <div className="flex items-center justify-between border-b border-menx-border/70 pb-4">
                    <div className="flex items-center space-x-2.5">
                      <Package className="w-5 h-5 text-menx-primary" />
                      <h2 className="text-base sm:text-lg font-extrabold text-white">Ordered Items</h2>
                    </div>
                    <span className="text-xs font-bold text-menx-text-secondary bg-menx-bg px-2.5 py-1 rounded-lg border border-menx-border">
                      {(order.order_items || []).length} {order.order_items?.length === 1 ? 'Product' : 'Products'}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {(order.order_items || []).map((item) => (
                      <OrderItemCard key={item.id} item={item} colors={catalogColors} />
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Column (1 Col): Order Summary, Price Breakdown, Delivery Address, Actions */}
              <div className="space-y-6">
                
                {/* 1. ORDER OVERVIEW CARD */}
                <div className="menx-card rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 text-sm">
                  <h3 className="font-extrabold text-white border-b border-menx-border/70 pb-3 flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-menx-primary" />
                    <span>Order Information</span>
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-menx-text-secondary">Order Channel</span>
                      <span className="font-bold text-white uppercase">{order.order_channel || 'ONLINE'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-menx-text-secondary">Payment Method</span>
                      <span className="font-bold text-white font-mono">
                        {order.payment_method === 'COD' ? 'COD (Cash on Delivery)' : order.payment_method}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-menx-text-secondary">Payment Status</span>
                      <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border ${
                        order.payment_status === 'PAID' || order.payment_status === 'COLLECTED'
                          ? 'bg-menx-success/10 border-menx-success/20 text-menx-success'
                          : 'bg-menx-warning/10 border-menx-warning/20 text-menx-warning'
                      }`}>
                        {order.payment_status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-menx-text-secondary">Est. Delivery</span>
                      <span className="font-bold text-white">3–5 Business Days</span>
                    </div>
                  </div>
                </div>

                {/* 2. PRICE FINANCIAL SUMMARY */}
                <div className="menx-card rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl text-sm">
                  <h3 className="font-extrabold text-white border-b border-menx-border/70 pb-3 flex items-center space-x-2">
                    <Truck className="w-4 h-4 text-menx-primary" />
                    <span>Payment Summary</span>
                  </h3>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between text-menx-text-secondary">
                      <span>Subtotal</span>
                      <span className="font-mono font-medium text-white">{formatCurrency(order.subtotal_amount)}</span>
                    </div>
                    {Number(order.discount_amount) > 0 && (
                      <div className="flex justify-between text-menx-success">
                        <span>Coupon Savings</span>
                        <span className="font-mono font-medium">-{formatCurrency(order.discount_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-menx-text-secondary">
                      <span>Delivery Fee</span>
                      <span className="font-mono font-medium text-white">
                        {Number(order.delivery_fee) === 0 ? (
                          <span className="text-menx-success font-bold">FREE</span>
                        ) : (
                          formatCurrency(order.delivery_fee)
                        )}
                      </span>
                    </div>
                    
                    <div className="border-t border-menx-border/70 pt-3 flex justify-between items-baseline text-sm font-extrabold text-white">
                      <span>Total Amount</span>
                      <span className="text-menx-primary text-xl font-black font-mono">
                        {formatCurrency(order.total_payable)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-menx-border/60 text-[11px] text-menx-text-secondary leading-relaxed flex items-start space-x-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-menx-text-muted mt-0.5 shrink-0" />
                    <span>
                      {order.payment_status === 'COLLECTED' || order.payment_status === 'PAID'
                        ? 'Payment has been successfully collected for this order.'
                        : 'Amount due in cash upon delivery to your doorstep.'}
                    </span>
                  </div>
                </div>

                {/* 3. SHIPPING / DELIVERY DESTINATION */}
                <div className="menx-card rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl text-sm">
                  <h3 className="font-extrabold text-white border-b border-menx-border/70 pb-3 flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-menx-primary" />
                    <span>Delivery Address</span>
                  </h3>

                  {order.shipping_snapshot ? (
                    <div className="space-y-2 leading-relaxed">
                      <div className="font-bold text-white text-sm">
                        {order.shipping_snapshot.recipient_name}
                      </div>
                      <div className="text-xs text-menx-text-secondary leading-relaxed">
                        {order.shipping_snapshot.address_line1}
                        {order.shipping_snapshot.address_line2 && `, ${order.shipping_snapshot.address_line2}`}
                        {order.shipping_snapshot.landmark && ` (Near ${order.shipping_snapshot.landmark})`}
                        <br />
                        {order.shipping_snapshot.city}, {order.shipping_snapshot.state} - <strong className="font-bold text-menx-primary">{order.shipping_snapshot.postal_code}</strong>
                      </div>
                      <div className="text-xs text-menx-text-muted pt-1 border-t border-menx-border/50 flex items-center space-x-1">
                        <span>Phone:</span>
                        <strong className="text-white">{order.shipping_snapshot.phone_number}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-menx-text-muted">Delivery address snapshot unavailable</div>
                  )}
                </div>

                {/* 4. ACTIONS PANEL */}
                <div className="space-y-3">
                  {isCancelable && (
                    <button
                      onClick={() => {
                        setCancelError(null);
                        setShowCancelModal(true);
                      }}
                      className="w-full py-3 px-5 bg-menx-error/10 hover:bg-menx-error/20 text-menx-error border border-menx-error/25 hover:border-menx-error/40 rounded-xl text-xs font-extrabold transition-all duration-150 uppercase tracking-wider flex items-center justify-center space-x-2"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Cancel Order</span>
                    </button>
                  )}

                  {order.order_status === 'DELIVERED' && (
                    <Link
                      to={`/returns/new?orderId=${order.id}`}
                      className="w-full py-3 px-5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] rounded-xl text-xs font-extrabold transition-all duration-150 uppercase tracking-wider flex items-center justify-center space-x-2 shadow-md shadow-menx-primary/20"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Return or Exchange Items</span>
                    </Link>
                  )}

                  {(order.order_status === 'RETURN_REQUESTED' || order.order_status === 'RETURNED') && (
                    <Link
                      to="/returns"
                      className="w-full py-3 px-5 bg-menx-surface border border-menx-border hover:bg-menx-surface-elevated text-menx-primary rounded-xl text-xs font-extrabold transition-all duration-150 uppercase tracking-wider flex items-center justify-center space-x-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>View Return Status</span>
                    </Link>
                  )}

                  <Link
                    to="/support"
                    className="w-full py-2.5 px-4 bg-transparent hover:bg-menx-surface-elevated/50 text-menx-text-secondary hover:text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 border border-dashed border-menx-border/80"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Need Help with this Order?</span>
                  </Link>
                </div>

              </div>

            </div>

          </div>
        )}

      </div>

      {/* Cancel Order Reason Modal */}
      <Modal
        isOpen={Boolean(showCancelModal)}
        onClose={() => setShowCancelModal(false)}
        maxWidth="max-w-md"
        title="Cancel Order"
        closeDisabled={cancelling}
        formProps={{
          onSubmit: handleCancelOrder,
        }}
        footer={(
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 w-full">
            <button
              type="button"
              disabled={cancelling}
              onClick={() => setShowCancelModal(false)}
              className="w-full sm:w-auto py-2.5 px-4 border border-menx-border hover:bg-menx-surface-elevated rounded-xl text-xs font-bold text-menx-text-secondary hover:text-white transition-colors disabled:opacity-50"
            >
              Keep Order
            </button>
            <button
              type="submit"
              disabled={cancelling}
              className="w-full sm:w-auto py-2.5 px-5 bg-menx-error hover:bg-red-700 disabled:bg-menx-surface-elevated text-white text-xs font-extrabold rounded-xl flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              {cancelling && <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent mr-1" />}
              <span>Confirm Cancellation</span>
            </button>
          </div>
        )}
      >
        <div className="space-y-4 text-sm">
          <p className="text-xs text-menx-text-secondary">
            Please choose a reason for cancelling order <strong className="text-white font-mono font-bold">#{order?.order_number}</strong>.
          </p>

          <div className="space-y-2.5">
            <label className="text-[10px] text-menx-text-secondary font-bold uppercase tracking-wider">Select Reason *</label>
            <div className="space-y-2">
              {[
                'Changed my mind',
                'Ordered by mistake',
                'Found a better price',
                'Delivery is taking too long',
                'Other'
              ].map((opt) => (
                <label
                  key={opt}
                  className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 ${
                    selectedReasonOpt === opt
                      ? 'bg-menx-primary/10 border-menx-primary/40 text-white'
                      : 'bg-menx-bg/50 border-menx-border/80 text-menx-text-secondary hover:text-white hover:border-menx-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    value={opt}
                    checked={selectedReasonOpt === opt}
                    onChange={() => {
                      setSelectedReasonOpt(opt);
                      setCancelError(null);
                    }}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    selectedReasonOpt === opt ? 'border-menx-primary' : 'border-menx-border'
                  }`}>
                    {selectedReasonOpt === opt && (
                      <div className="w-2 h-2 rounded-full bg-menx-primary" />
                    )}
                  </div>
                  <span className="text-xs sm:text-sm font-medium">{opt}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedReasonOpt === 'Other' && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-menx-text-secondary font-bold uppercase tracking-wider">Please specify *</label>
              <textarea
                required
                rows={2}
                value={customReasonText}
                onChange={(e) => {
                  setCustomReasonText(e.target.value);
                  setCancelError(null);
                }}
                placeholder="Type your cancellation reason here..."
                className="w-full bg-menx-bg border border-menx-border rounded-xl p-3 text-xs sm:text-sm text-white placeholder-gray-600 focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary font-medium"
              />
            </div>
          )}

          {cancelError && (
            <div className="bg-menx-error/10 border border-menx-error/20 text-menx-error p-3 rounded-xl flex items-start space-x-2 text-xs">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{cancelError}</span>
            </div>
          )}
        </div>
      </Modal>

    </BaseLayout>
  );
}
