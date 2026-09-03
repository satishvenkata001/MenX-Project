import React, { useEffect, useState } from 'react';
import { api } from '../utils/api.js';
import { Calendar, Package, ArrowRight, ShoppingBag, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';
import { formatCurrency } from '../utils/formatters.js';

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/orders?limit=20');
        setOrders(res.data?.orders || []);
      } catch (err) {
        console.error('Failed to load orders:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, []);

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

  const getPaymentStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-500/10 border-green-500/20 text-green-400';
      case 'PENDING':
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
      case 'COLLECTED':
        return 'bg-teal-500/10 border-teal-500/20 text-teal-400';
      case 'REFUNDED':
        return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
      default:
        return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
    }
  };

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow space-y-8">
        
        {/* Header */}
        <div className="border-b border-gray-800 pb-6 flex items-center space-x-2">
          <Package className="w-8 h-8 text-amber-500" />
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Your Orders</h1>
        </div>

        {/* Loading / Error / Empty States */}
        {loading ? (
          <div className="flex justify-center py-20 flex-grow">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-xl text-center space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="font-bold">Failed to load order history</p>
            <p className="text-xs text-gray-400">{error}</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-gray-900 border border-gray-850 p-12 rounded-xl text-center text-gray-500 space-y-4 max-w-lg mx-auto shadow-lg my-12">
            <div className="w-16 h-16 bg-gray-950 rounded-full flex items-center justify-center mx-auto border border-gray-800">
              <ShoppingBag className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-white text-lg font-bold tracking-tight">No Orders Yet</h3>
            <p className="text-sm text-gray-400">
              You haven't placed any purchases yet. Shop our collections and make your first order!
            </p>
            <div className="pt-2">
              <Link
                to="/"
                className="inline-flex items-center space-x-2 py-3 px-6 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition-colors"
              >
                <span>Shop Collections</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-gray-900 border border-gray-850 hover:border-gray-850/80 rounded-2xl p-6 transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-mono font-bold text-gray-400 uppercase">
                      Order: {order.order_number}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(order.order_status)}`}>
                      {order.order_status}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPaymentStatusBadge(order.payment_status)}`}>
                      PAYMENT: {order.payment_status}
                    </span>
                  </div>
                  
                  <div className="flex items-center text-xs text-gray-400 space-x-4">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      <span>{new Date(order.created_at).toLocaleDateString()}</span>
                    </span>
                    <span>•</span>
                    <span>Method: {order.payment_method}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-gray-850 pt-4 md:pt-0">
                  <div className="text-left md:text-right">
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Total Amount</div>
                    <div className="text-xl font-black text-amber-500">{formatCurrency(order.total_payable)}</div>
                  </div>
                  
                  <Link
                    to={`/orders/${order.id}`}
                    className="inline-flex items-center space-x-1.5 py-2.5 px-4 bg-gray-950 hover:bg-gray-800 text-amber-500 border border-gray-800 rounded-xl text-xs font-bold transition-all"
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </BaseLayout>
  );
}
