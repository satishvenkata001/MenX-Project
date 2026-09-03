import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api.js';
import { Package, Calendar, MapPin, Truck, HelpCircle, ArrowLeft, Check, AlertTriangle, Clock, X } from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';
import { formatCurrency } from '../utils/formatters.js';

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
  const [selectedReasonOpt, setSelectedReasonOpt] = useState('Changed my mind');
  const [customReasonText, setCustomReasonText] = useState('');
  const [cancelError, setCancelError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

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
      await loadOrderDetails(); // Reload details to show updated cancelled state
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
  const timelineStatuses = order && order.order_status === 'CANCELLED'
    ? ['PENDING', ...(statusHistory.some(h => h.to_status === 'CONFIRMED') ? ['CONFIRMED'] : []), 'CANCELLED']
    : ['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

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

        {successMessage && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl flex items-center justify-between shadow-md">
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-400" />
              <span className="text-sm font-medium">{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-green-400 hover:text-green-300 text-xs font-bold uppercase tracking-wider"
            >
              Dismiss
            </button>
          </div>
        )}

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
                  onClick={() => {
                    setCancelError(null);
                    setShowCancelModal(true);
                  }}
                  className="py-2.5 px-5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 rounded-xl text-xs font-bold transition-all duration-150 uppercase tracking-wider"
                >
                  Cancel Order
                </button>
              )}

              {order.order_status === 'CANCELLED' && (
                <span className="py-2.5 px-5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold uppercase tracking-wider select-none">
                  ORDER CANCELLED
                </span>
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
            {order && (
              <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 shadow-md space-y-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
                  <Clock className="w-4 h-4 text-amber-500 mr-1.5" />
                  <span>Tracking Progress</span>
                </h3>

                <div className="relative">
                  {/* Progress Line */}
                  <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-850 -z-10 hidden md:block" />

                  <div className={`grid grid-cols-1 ${
                    timelineStatuses.length === 2 ? 'md:grid-cols-2' : timelineStatuses.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-6'
                  } gap-6 relative`}>
                    {timelineStatuses.map((statusName, idx) => {
                      const event = getStatusEvent(statusName);
                      const isCompleted = !!event || order.order_status === statusName;
                      
                      // Check if previous step completed to style connectives
                      const currentStatusIdx = timelineStatuses.indexOf(order.order_status);
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
                          <div className="font-bold text-white">{formatCurrency(item.line_total)}</div>
                          <div className="text-xs text-gray-400 font-mono">
                            {formatCurrency(item.unit_price_snapshot)} x {item.quantity}
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
                      <span>{formatCurrency(order.subtotal_amount)}</span>
                    </div>
                    {Number(order.discount_amount) > 0 && (
                      <div className="flex justify-between text-green-400 text-xs">
                        <span>Coupon Savings</span>
                        <span>-{formatCurrency(order.discount_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-400 text-xs">
                      <span>Delivery Fee</span>
                      <span>{formatCurrency(order.delivery_fee)}</span>
                    </div>
                    <div className="border-t border-gray-800 pt-3 flex justify-between text-sm font-extrabold text-white">
                      <span>Total Payable</span>
                      <span className="text-amber-500 font-black">{formatCurrency(order.total_payable)}</span>
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
              <h3 className="text-lg font-bold text-white">Cancel Order?</h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="p-1 rounded-lg border border-gray-800 text-gray-404 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-400">
              Are you sure you want to cancel this order?
            </p>

            <form onSubmit={handleCancelOrder} className="space-y-4 text-sm">
              <div className="space-y-3">
                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Cancellation reason</label>
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
                          ? 'bg-amber-500/10 border-amber-500/40 text-white'
                          : 'bg-gray-950/50 border-gray-850/80 text-gray-400 hover:text-white hover:border-gray-800'
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
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        selectedReasonOpt === opt ? 'border-amber-500' : 'border-gray-600'
                      }`}>
                        {selectedReasonOpt === opt && (
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                        )}
                      </div>
                      <span className="text-sm font-medium">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {selectedReasonOpt === 'Other' && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Please specify *</label>
                  <textarea
                    required
                    rows={2}
                    value={customReasonText}
                    onChange={(e) => {
                      setCustomReasonText(e.target.value);
                      setCancelError(null);
                    }}
                    placeholder="Type your cancellation reason here..."
                    className="w-full bg-gray-950 border border-gray-850 rounded-xl p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium"
                  />
                </div>
              )}

              {cancelError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl flex items-start space-x-2 text-xs">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{cancelError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="py-2.5 px-4 border border-gray-800 hover:bg-gray-800 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Keep Order
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-850 text-white text-xs font-extrabold rounded-xl flex items-center space-x-1 transition-colors"
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
