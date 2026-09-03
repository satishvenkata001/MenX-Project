import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, ShoppingBag, Calendar, Truck, ArrowRight, MapPin, Receipt, Clock } from 'lucide-react';
import { api } from '../utils/api.js';
import BaseLayout from '../components/BaseLayout.jsx';
import { formatCurrency } from '../utils/formatters.js';

export default function OrderSuccess() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
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
        const res = await api.get(`/orders/${orderId}`);
        setOrder(res.data);
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
        <div className="flex justify-center items-center py-32 flex-grow">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
            <span className="text-sm text-gray-400 font-medium">Fetching order confirmation...</span>
          </div>
        </div>
      </BaseLayout>
    );
  }

  if (error || !order) {
    return (
      <BaseLayout>
        <div className="max-w-md mx-auto my-20 p-8 bg-gray-900 border border-gray-800 rounded-2xl text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 rotate-180" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">Oops! Fetch Failed</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            {error || 'Unable to retrieve order details. Please verify your internet connection or check your order history.'}
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center space-x-2 py-2.5 px-6 bg-amber-500 hover:bg-amber-600 text-black text-xs font-extrabold rounded-lg transition-colors"
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
      <div className="max-w-4xl mx-auto my-12 px-4 sm:px-6 py-12 bg-gray-900 border border-gray-850 rounded-2xl space-y-8 shadow-2xl relative overflow-hidden">
        
        {/* Top Gradient Bar */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />
        
        {/* Success Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto shadow-inner mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Order Placed Successfully!</h2>
          <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
            Thank you for shopping with MENX. Your Cash on Delivery order is confirmed and is being packaged for shipment.
          </p>
        </div>

        {/* Order Meta Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-gray-950/40 border border-gray-850 rounded-xl text-center text-xs">
          <div>
            <div className="text-gray-500 font-bold uppercase tracking-wider">Order ID</div>
            <div className="text-white font-mono font-bold mt-1 truncate px-1">{order.order_number}</div>
          </div>
          <div>
            <div className="text-gray-500 font-bold uppercase tracking-wider">Payment Method</div>
            <div className="text-amber-500 font-bold mt-1">Cash on Delivery</div>
          </div>
          <div>
            <div className="text-gray-500 font-bold uppercase tracking-wider">Total Payable</div>
            <div className="text-white font-extrabold mt-1 font-mono">{formatCurrency(order.total_payable)}</div>
          </div>
          <div>
            <div className="text-gray-500 font-bold uppercase tracking-wider">Fulfillment Status</div>
            <div className="text-indigo-400 font-bold mt-1 uppercase font-mono">{order.order_status}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Shipping Address Snapshot */}
          <div className="bg-gray-950/40 border border-gray-850 p-6 rounded-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center border-b border-gray-850 pb-2">
              <MapPin className="w-4 h-4 text-amber-500 mr-2" />
              <span>Delivery Address</span>
            </h3>
            {shipping ? (
              <div className="space-y-2 text-xs text-gray-300 leading-relaxed font-medium">
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{shipping.recipient_name}</span>
                  {shipping.address_type && (
                    <span className="text-[9px] bg-gray-800 border border-gray-700 text-gray-400 px-1.5 py-0.5 rounded font-mono uppercase">
                      {shipping.address_type}
                    </span>
                  )}
                </div>
                <div>{shipping.address_line1}</div>
                {shipping.address_line2 && <div>{shipping.address_line2}</div>}
                {shipping.landmark && <div className="text-gray-400">Near: {shipping.landmark}</div>}
                <div>{shipping.city}, {shipping.state}</div>
                <div className="font-bold text-amber-500/90 font-mono">ZIP Code: {shipping.postal_code}</div>
                <div className="pt-1 text-gray-400">Phone: {shipping.phone_number}</div>
              </div>
            ) : (
              <div className="text-xs text-gray-500">Address details unavailable.</div>
            )}
          </div>

          {/* Delivery Window Summary */}
          <div className="bg-gray-950/40 border border-gray-850 p-6 rounded-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center border-b border-gray-850 pb-2">
              <Truck className="w-4 h-4 text-amber-500 mr-2" />
              <span>Shipment Information</span>
            </h3>
            <div className="space-y-4 text-xs">
              <div className="flex items-start space-x-3">
                <Clock className="w-4 h-4 text-gray-500 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white">Estimated Delivery Time</h4>
                  <p className="text-gray-400 mt-0.5">3 to 5 Business Days</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Calendar className="w-4 h-4 text-gray-500 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white">Courier Dispatch</h4>
                  <p className="text-gray-400 mt-0.5">Dispatched within 24 hours from store center</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Product Items Breakdown */}
        <div className="border border-gray-850 bg-gray-950/30 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center border-b border-gray-850 pb-2">
            <Receipt className="w-4 h-4 text-amber-500 mr-2" />
            <span>Items Ordered</span>
          </h3>
          <div className="divide-y divide-gray-850 space-y-3">
            {items && items.map((item) => {
              // Extract primary image URL if returned
              const imagesList = item.variant?.product?.images || [];
              const primaryImage = [...imagesList].sort(
                (a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.display_order - b.display_order
              )[0];

              return (
                <div key={item.id} className="pt-3 first:pt-0 flex gap-4 text-xs font-medium">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 bg-gray-950 border border-gray-850 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {primaryImage?.image_url ? (
                      <img src={primaryImage.image_url} alt={item.product_title_snapshot} className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag className="w-6 h-6 text-gray-700" />
                    )}
                  </div>
                  {/* Metadata */}
                  <div className="flex-grow min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      <h4 className="font-bold text-white truncate text-sm">{item.product_title_snapshot}</h4>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">SKU: {item.variant_sku_snapshot}</p>
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-[10px] text-gray-400 mt-1">
                      {item.size_snapshot && <span>Size: {item.size_snapshot}</span>}
                      {item.color_snapshot && <span>Color: {item.color_snapshot}</span>}
                      <span>Qty: {item.quantity}</span>
                    </div>
                  </div>
                  {/* Price */}
                  <div className="text-right flex flex-col justify-between py-0.5 flex-shrink-0">
                    <span className="text-gray-400">{formatCurrency(item.unit_price_snapshot)} each</span>
                    <span className="font-extrabold text-amber-500 font-mono text-sm">{formatCurrency(item.line_total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4 max-w-md mx-auto">
          <Link
            to={`/orders/${orderId}`}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 py-3 px-6 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs rounded-lg transition-all duration-200 shadow-md shadow-amber-500/10 uppercase tracking-wider"
          >
            <span>View Order Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 py-3 px-6 border border-gray-800 hover:bg-gray-800 text-gray-400 hover:text-white font-bold text-xs rounded-lg transition-colors duration-200 uppercase tracking-wider"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Continue Shopping</span>
          </Link>
        </div>

      </div>
    </BaseLayout>
  );
}
