import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api.js';
import { Package, Calendar, MapPin, Truck, HelpCircle, ArrowLeft, Check, AlertTriangle, Clock } from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';

export default function OrderDetails() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cancellation States
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Load details and status history
  async function loadOrderDetails() {
    setLoading(true);
    setError(null);
    try {
      const [detailsRes, historyRes] = await Promise.all([
        api.get(`/orders/${orderId}`),
        api.get(`/orders/${orderId}/status-history`)
      ]);
      setOrder(detailsRes.data);
      setStatusHistory(historyRes.data || []);
    } catch (err) {
      console.error('Failed to load order details:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrderDetails();
  }, [orderId]);

  const handleCancelOrder = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      alert('Please enter a cancellation reason.');
      return;
    }

    setCancelling(true);
    try {
      await api.post(`/orders/${orderId}/cancel`, { reason: cancelReason });
      setShowCancelModal(false);
      setCancelReason('');
      await loadOrderDetails(); // Reload details to show updated cancelled state
    } catch (err) {
      alert(err.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
      case 'CONFIRMED':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'PACKED':
        return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
      case 'SHIPPED':
        return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
      case 'OUT_FOR_DELIVERY':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'DELIVERED':
        return 'bg-green-500/10 border-green-500/20 text-green-400';
      case 'CANCELLED':
        return 'bg-red-500/10 border-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
    }
  };

  // Status timeline definition
  const statuses = ['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

  // Check if a status transition was completed and fetch the timestamp
  const getStatusEvent = (statusName) => {
    return statusHistory.find(h => h.to_status === statusName);
  };

  const isCancelable = order && ['PENDING', 'CONFIRMED'].includes(order.order_status);

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow space-y-8">
        
        {/* Back navigation */}
        <Link
          to="/orders"
          className="inline-flex items-center space-x-1.5 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to orders</span>
        </Link>

        {/* Loading / Error States */}
        {loading ? (
          <div className="flex justify-center py-20 flex-grow">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
          </div>
        ) : error || !order ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-xl text-center space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto" />
            <p className="font-bold">Failed to load order details</p>
            <p className="text-xs text-gray-400">{error || 'Order not found'}</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Order Overview Panel */}
            <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-md">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-black text-white">Order {order.order_number}</h2>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(order.order_status)}`}>
                    {order.order_status}
                  </span>
                </div>
                <div className="flex items-center text-xs text-gray-400 space-x-4">
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-500" />
                    <span>Placing Date: {new Date(order.created_at).toLocaleString()}</span>
                  </span>
                </div>
              </div>

              {isCancelable && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="py-2.5 px-5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 rounded-xl text-xs font-bold transition-all duration-150 uppercase tracking-wider"
                >
                  Cancel Order
                </button>
              )}

              {order.order_status === 'DELIVERED' && (
                <Link
                  to={`/returns/new?orderId=${order.id}`}
                  className="py-2.5 px-5 bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-xs font-bold transition-all duration-150 uppercase tracking-wider text-center"
                >
                  Return or Exchange Items
                </Link>
              )}
            </div>

            {/* Visual Status Timeline Progress Tracker */}
            {order.order_status !== 'CANCELLED' && (
              <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 shadow-md space-y-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
                  <Clock className="w-4 h-4 text-amber-500 mr-1.5" />
                  <span>Tracking Progress</span>
                </h3>

                <div className="relative">
                  {/* Progress Line */}
                  <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-850 -z-10 hidden md:block" />

                  <div className="grid grid-cols-1 md:grid-cols-6 gap-6 relative">
                    {statuses.map((statusName, idx) => {
                      const event = getStatusEvent(statusName);
                      const isCompleted = !!event || order.order_status === statusName;
                      
                      // Check if previous step completed to style connectives
                      const currentStatusIdx = statuses.indexOf(order.order_status);
                      const isActive = isCompleted || idx <= currentStatusIdx;

                      return (
                        <div key={statusName} className="flex md:flex-col items-start md:items-center space-x-4 md:space-x-0 md:text-center text-sm">
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
                            isActive
                              ? 'bg-amber-500/15 border-amber-500 text-amber-400 shadow-md shadow-amber-500/5'
                              : 'bg-gray-950 border-gray-800 text-gray-500'
                          }`}>
                            {isActive ? (
                              <Check className="w-4 h-4 stroke-[3]" />
                            ) : (
                              <span className="text-xs font-bold">{idx + 1}</span>
                            )}
                          </div>

                          <div className="md:pt-3 space-y-0.5">
                            <h4 className={`font-bold text-xs uppercase tracking-wider ${
                              isActive ? 'text-white' : 'text-gray-500'
                            }`}>
                              {statusName.replace(/_/g, ' ')}
                            </h4>
                            {event && (
                              <p className="text-[10px] text-gray-500">
                                {new Date(event.created_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Cancelled Alert Box */}
            {order.order_status === 'CANCELLED' && (
              <div className="bg-red-500/5 border border-red-500/20 text-red-400 p-5 rounded-2xl flex items-start space-x-3 shadow-md">
                <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="space-y-1 text-sm">
                  <h4 className="font-bold text-white">This Order has been Cancelled</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    This order was cancelled successfully and all items have been returned to store catalog stock.
                  </p>
                </div>
              </div>
            )}

            {/* Details Split Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* Frozen snapshotted items */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 shadow-md space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-gray-800 pb-3">Items Purchased</h3>
                  
                  <div className="divide-y divide-gray-850">
                    {(order.order_items || []).map((item) => (
                      <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex gap-4 items-center justify-between">
                        <div className="space-y-1 text-sm">
                          <h4 className="font-bold text-white">{item.product_title_snapshot}</h4>
                          <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                            <span className="font-mono">SKU: {item.variant_sku_snapshot}</span>
                            <span>•</span>
                            <span>Color: {item.color_snapshot}</span>
                            <span>•</span>
                            <span>Size: {item.size_snapshot}</span>
                          </div>
                        </div>

                        <div className="text-right text-sm">
                          <div className="font-bold text-white">₹{item.line_total}</div>
                          <div className="text-xs text-gray-400 font-mono">
                            ₹{item.unit_price_snapshot} x {item.quantity}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Delivery and Payment Summary */}
              <div className="space-y-6">
                
                {/* Delivery details snapshot */}
                <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 space-y-4 shadow-md text-sm">
                  <h3 className="font-bold text-white border-b border-gray-800 pb-3 flex items-center">
                    <MapPin className="w-4 h-4 text-amber-500 mr-1.5" />
                    <span>Delivery Address</span>
                  </h3>

                  {order.shipping_snapshot ? (
                    <div className="space-y-2 leading-relaxed">
                      <div className="font-bold text-white">
                        {order.shipping_snapshot.recipient_name}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">
                        {order.shipping_snapshot.address_line1}
                        {order.shipping_snapshot.address_line2 && `, ${order.shipping_snapshot.address_line2}`}
                        {order.shipping_snapshot.landmark && ` (Near ${order.shipping_snapshot.landmark})`}
                        <br />
                        {order.shipping_snapshot.city}, {order.shipping_snapshot.state} - <span className="font-bold text-amber-500/85">{order.shipping_snapshot.postal_code}</span>
                      </div>
                      <div className="text-xs text-gray-400 pt-1">
                        Phone: {order.shipping_snapshot.phone_number}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">Address snapshots missing</div>
                  )}
                </div>

                {/* Price breakdown summary */}
                <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 space-y-4 shadow-md text-sm">
                  <h3 className="font-bold text-white border-b border-gray-800 pb-3 flex items-center">
                    <Truck className="w-4 h-4 text-amber-500 mr-1.5" />
                    <span>Payment Details</span>
                  </h3>

                  <div className="space-y-3">
                    <div className="flex justify-between text-gray-400 text-xs">
                      <span>Subtotal</span>
                      <span>₹{order.subtotal_amount}</span>
                    </div>
                    {Number(order.discount_amount) > 0 && (
                      <div className="flex justify-between text-green-400 text-xs">
                        <span>Coupon Savings</span>
                        <span>-₹{order.discount_amount}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-400 text-xs">
                      <span>Delivery Fee</span>
                      <span>₹{order.delivery_fee}</span>
                    </div>
                    <div className="border-t border-gray-800 pt-3 flex justify-between text-sm font-extrabold text-white">
                      <span>Total Paid (COD)</span>
                      <span className="text-amber-500 font-black">₹{order.total_payable}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-800 text-[11px] text-gray-400 leading-relaxed flex items-start space-x-1">
                    <HelpCircle className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Order placed via Cash on Delivery. Expected delivery within 3-5 business days.
                    </span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </div>

      {/* Cancel Order Reason Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-6">
            
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white">Cancel Your Order</h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="p-1 rounded-lg border border-gray-800 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCancelOrder} className="space-y-4 text-sm">
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-bold uppercase">Reason for cancellation *</label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Tell us why you would like to cancel this order..."
                  className="w-full bg-gray-950 border border-gray-850 rounded-xl p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="py-2 px-4 border border-gray-800 hover:bg-gray-800 rounded-lg text-xs font-bold text-gray-400 hover:text-white"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="py-2 px-4 bg-red-500 hover:bg-red-600 disabled:bg-gray-800 text-white text-xs font-extrabold rounded-lg flex items-center space-x-1"
                >
                  {cancelling && <div className="animate-spin rounded-full h-3 w-3 border-t border-white mr-1" />}
                  <span>Cancel Order</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </BaseLayout>
  );
}
