import React, { useEffect, useState } from 'react';
import { api } from '../utils/api.js';
import { RotateCcw, Calendar, ArrowRight, Package, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';
import { formatCurrency, formatDate } from '../utils/formatters.js';

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
        return 'bg-menx-info/10 border-menx-info/20 text-menx-info';
      case 'APPROVED':
        return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
      case 'REJECTED':
        return 'bg-menx-error/10 border-menx-error/20 text-menx-error';
      case 'PICKUP_SCHEDULED':
        return 'bg-menx-warning/10 border-menx-warning/20 text-menx-warning';
      case 'RECEIVED_IN_STORE':
        return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
      case 'COMPLETED':
        return 'bg-menx-success/10 border-menx-success/20 text-menx-success';
      case 'CANCELLED':
        return 'bg-gray-500/10 border-gray-500/20 text-menx-text-secondary';
      default:
        return 'bg-gray-500/10 border-gray-500/20 text-menx-text-secondary';
    }
  };

  const getReasonLabel = (reason) => {
    return (reason || '').replace(/_/g, ' ');
  };

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow space-y-8">
        
        {/* Header */}
        <div className="border-b border-menx-border pb-6 flex items-center space-x-2">
          <RotateCcw className="w-8 h-8 text-menx-primary" />
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Returns & Exchanges</h1>
        </div>

        {/* Loading / Error / Empty States */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-menx-primary"></div>
          </div>
        ) : error ? (
          <div className="bg-menx-error/10 border border-menx-error/20 text-menx-error p-6 rounded-xl text-center space-y-2 max-w-lg mx-auto">
            <AlertTriangle className="w-8 h-8 mx-auto" />
            <p className="font-bold">Failed to load returns</p>
            <p className="text-xs text-menx-text-secondary">{error}</p>
          </div>
        ) : returns.length === 0 ? (
          <div className="menx-card p-12 rounded-2xl text-center text-menx-text-muted space-y-4 max-w-lg mx-auto shadow-lg">
            <RotateCcw className="w-12 h-12 mx-auto text-menx-text-muted" />
            <h3 className="text-white text-lg font-bold">No Returns Initiated</h3>
            <p className="text-sm text-menx-text-secondary">
              You haven't initiated any product returns or exchanges.
            </p>
            <div className="pt-2">
              <Link
                to="/orders"
                className="inline-flex items-center space-x-2 py-3 px-6 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] font-bold rounded-lg transition-colors"
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
                className="menx-card rounded-2xl p-4 sm:p-6 transition-all duration-150 space-y-4 hover:border-menx-primary/30 shadow-md"
              >
                {/* Header: ID, Status Badge, Request Type Badge */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-menx-primary uppercase tracking-wide">
                      ID: {req.return_number}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(req.status)}`}>
                      {req.status}
                    </span>
                    <span className="text-[10px] font-bold bg-menx-surface-elevated border border-menx-border text-menx-text-secondary px-2 py-0.5 rounded uppercase">
                      {req.request_type === 'EXCHANGE' ? 'Size Exchange' : 'Return'}
                    </span>
                  </div>
                </div>

                {/* Sub-header: Date and Reason */}
                <div className="flex flex-wrap items-center text-xs text-menx-text-secondary gap-x-3 gap-y-1">
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-menx-text-muted" />
                    <span>{formatDate(req.created_at)}</span>
                  </span>
                  <span>•</span>
                  <span className="capitalize">
                    Reason: <strong className="text-menx-text uppercase font-semibold text-[11px]">{getReasonLabel(req.reason)}</strong>
                  </span>
                </div>

                {/* Divider Line */}
                <div className="border-t border-menx-border/60" />

                {/* Product Section */}
                <div className="space-y-3">
                  {(req.items && req.items.length > 0 ? req.items : [{}]).map((item, idx) => (
                    <div key={item.id || idx} className="flex items-start sm:items-center gap-3 sm:gap-4">
                      {/* Compact Square Thumbnail */}
                      <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl bg-menx-bg border border-menx-border flex-shrink-0 overflow-hidden flex items-center justify-center relative p-1">
                        {item.primary_image_url ? (
                          <img
                            src={item.primary_image_url}
                            alt={item.product_title_snapshot || 'Product thumbnail'}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <Package className="w-6 h-6 sm:w-8 sm:h-8 text-menx-text-muted" />
                        )}
                      </div>

                      {/* Product Name & Attributes */}
                      <div className="flex-1 min-w-0 space-y-1 sm:space-y-1.5">
                        <h4 className="font-bold text-white text-sm sm:text-base leading-snug break-words line-clamp-2">
                          {item.product_title_snapshot || 'Returned Product'}
                        </h4>

                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-menx-text-secondary">
                          {item.color_snapshot && (
                            <span>Color: <strong className="text-menx-text font-mono">{item.color_snapshot}</strong></span>
                          )}
                          {item.color_snapshot && item.size_snapshot && <span>|</span>}
                          {item.size_snapshot && (
                            <span>Size: <strong className="text-menx-primary font-mono">{item.size_snapshot}</strong></span>
                          )}
                          {req.request_type === 'EXCHANGE' && item.replacement_size && (
                            <>
                              <span>|</span>
                              <span className="text-indigo-400">Exchange to: <strong>Size {item.replacement_size}</strong></span>
                            </>
                          )}
                          {item.quantity && item.quantity > 1 && (
                            <>
                              <span>|</span>
                              <span>Qty: <strong className="text-white">{item.quantity}</strong></span>
                            </>
                          )}
                          {item.unit_price_snapshot !== undefined && item.unit_price_snapshot !== null && (
                            <>
                              <span className="hidden sm:inline">|</span>
                              <span className="hidden sm:inline font-mono font-bold text-white">
                                {formatCurrency(item.unit_price_snapshot)}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Mobile Price display */}
                        {item.unit_price_snapshot !== undefined && item.unit_price_snapshot !== null && (
                          <div className="sm:hidden text-xs font-mono font-bold text-white pt-0.5">
                            {formatCurrency(item.unit_price_snapshot)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Divider Line */}
                <div className="border-t border-menx-border/60" />

                {/* Action Section */}
                <div className="flex items-center justify-end pt-1">
                  <Link
                    to={`/returns/${req.id}`}
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 py-2.5 px-5 bg-menx-bg hover:bg-menx-surface-elevated text-menx-primary border border-menx-border rounded-xl text-xs font-bold transition-all shadow-sm group"
                  >
                    <span>Track Status</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
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
