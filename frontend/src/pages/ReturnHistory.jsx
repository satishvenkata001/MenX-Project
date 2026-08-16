import React, { useEffect, useState } from 'react';
import { api } from '../utils/api.js';
import { RotateCcw, Calendar, ArrowRight, ShoppingBag, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';

export default function ReturnHistory() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadReturns() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/returns?limit=20');
        setReturns(res.data?.returns || res.data || []);
      } catch (err) {
        console.error('Failed to load returns history:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadReturns();
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'REQUESTED':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'APPROVED':
        return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
      case 'REJECTED':
        return 'bg-red-500/10 border-red-500/20 text-red-400';
      case 'PICKUP_SCHEDULED':
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
      case 'RECEIVED_IN_STORE':
        return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
      case 'COMPLETED':
        return 'bg-green-500/10 border-green-500/20 text-green-400';
      case 'CANCELLED':
        return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
      default:
        return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
    }
  };

  const getReasonLabel = (reason) => {
    return reason.replace(/_/g, ' ');
  };

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow space-y-8">
        
        {/* Header */}
        <div className="border-b border-gray-800 pb-6 flex items-center space-x-2">
          <RotateCcw className="w-8 h-8 text-amber-500" />
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Returns & Exchanges</h1>
        </div>

        {/* Loading / Error / Empty States */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-xl text-center space-y-2 max-w-lg mx-auto">
            <AlertTriangle className="w-8 h-8 mx-auto" />
            <p className="font-bold">Failed to load returns</p>
            <p className="text-xs text-gray-400">{error}</p>
          </div>
        ) : returns.length === 0 ? (
          <div className="bg-gray-900 border border-gray-850 p-12 rounded-xl text-center text-gray-500 space-y-4 max-w-lg mx-auto shadow-lg">
            <RotateCcw className="w-12 h-12 mx-auto text-gray-700" />
            <h3 className="text-white text-lg font-bold">No Returns Initiated</h3>
            <p className="text-sm text-gray-400">
              You haven't initiated any product returns or exchanges.
            </p>
            <div className="pt-2">
              <Link
                to="/orders"
                className="inline-flex items-center space-x-2 py-3 px-6 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition-colors"
              >
                <span>View Delivered Orders</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {returns.map((req) => (
              <div
                key={req.id}
                className="bg-gray-900 border border-gray-850 hover:border-gray-800 rounded-2xl p-6 transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-mono font-bold text-amber-500 uppercase">
                      ID: {req.return_number}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(req.status)}`}>
                      {req.status}
                    </span>
                    <span className="text-[10px] font-bold bg-gray-850 border border-gray-800 text-gray-400 px-2 py-0.5 rounded uppercase">
                      {req.request_type}
                    </span>
                  </div>

                  <div className="flex items-center text-xs text-gray-400 space-x-4">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      <span>{new Date(req.created_at).toLocaleDateString()}</span>
                    </span>
                    <span>•</span>
                    <span className="capitalize">Reason: {getReasonLabel(req.reason)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-gray-850 pt-4 md:pt-0">
                  <Link
                    to={`/returns/${req.id}`}
                    className="inline-flex items-center space-x-1.5 py-2.5 px-4 bg-gray-950 hover:bg-gray-800 text-amber-500 border border-gray-850 rounded-xl text-xs font-bold transition-all"
                  >
                    <span>Track Status</span>
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
