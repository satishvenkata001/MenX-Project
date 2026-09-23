import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api.js';
import {
  RotateCcw,
  Calendar,
  ArrowLeft,
  Check,
  AlertTriangle,
  Clock,
  HelpCircle,
  User,
  Package,
  ExternalLink,
  ShieldCheck,
  Truck
} from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';
import { formatCurrency, formatDate } from '../utils/formatters.js';

export default function ReturnDetails() {
  const { returnId } = useParams();
  const [returnReq, setReturnReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  async function loadReturnDetails() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/returns/${returnId}`);
      setReturnReq(res.data);
    } catch (err) {
      console.error('Failed to load return details:', err.message);
      setError(err.data?.message || err.message || 'Failed to retrieve return details');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReturnDetails();
  }, [returnId]);

  const handleCancelRequest = async () => {
    if (!window.confirm('Are you sure you want to cancel this return/exchange request?')) {
      return;
    }

    setCancelling(true);
    setCancelError(null);
    try {
      await api.post(`/returns/${returnId}/cancel`);
      setCancelSuccess(true);
      await loadReturnDetails(); // Reload to show cancelled status
    } catch (err) {
      setCancelError(err.data?.message || err.message || 'Failed to cancel return request');
    } finally {
      setCancelling(false);
    }
  };

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

  // Status timeline tracking path
  const trackingStatuses = ['REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED', 'RECEIVED_IN_STORE', 'COMPLETED'];

  const getStatusEvent = (statusName) => {
    if (!returnReq || !returnReq.history) return null;
    return returnReq.history.find(h => h.to_status === statusName);
  };

  const isCancelable = returnReq && returnReq.status === 'REQUESTED';

  // Find any reject/cancel comments from history log notes
  const getAdminNotes = () => {
    if (!returnReq || !returnReq.history) return [];
    return returnReq.history.filter(h => h.comment && h.comment.trim() !== '');
  };

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-grow space-y-8">
        
        {/* Back navigation link */}
        <Link
          to="/returns"
          className="inline-flex items-center space-x-1.5 text-sm font-semibold text-menx-text-secondary hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to returns list</span>
        </Link>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-menx-primary"></div>
          </div>
        ) : error || !returnReq ? (
          <div className="bg-menx-error/10 border border-menx-error/20 text-menx-error p-8 rounded-2xl text-center space-y-3 max-w-lg mx-auto shadow-lg">
            <AlertTriangle className="w-10 h-10 mx-auto text-menx-error" />
            <h3 className="text-lg font-bold text-white">Failed to load return details</h3>
            <p className="text-xs text-menx-text-secondary leading-relaxed">{error || 'The requested return record could not be found or access is restricted.'}</p>
            <div className="pt-2">
              <button
                onClick={loadReturnDetails}
                className="px-4 py-2 bg-menx-surface hover:bg-menx-surface-elevated text-white rounded-lg text-xs font-bold border border-menx-border transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Overview Panel Header */}
            <div className="menx-card rounded-2xl p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-md">
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl sm:text-2xl font-black text-white font-mono">{returnReq.return_number}</h2>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${getStatusBadge(returnReq.status)}`}>
                    {returnReq.status}
                  </span>
                  <span className="text-xs font-bold bg-menx-bg border border-menx-border text-menx-primary px-2.5 py-1 rounded-md uppercase tracking-wider">
                    {returnReq.request_type === 'EXCHANGE' ? 'Size Exchange' : 'Refund Return'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center text-xs text-menx-text-secondary gap-x-5 gap-y-1">
                  <span className="flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-menx-text-muted" />
                    <span>Requested: {formatDate(returnReq.created_at, true)}</span>
                  </span>
                  {returnReq.order_number && (
                    <span className="flex items-center space-x-1">
                      <span className="text-menx-text-muted">Order:</span>
                      <Link
                        to={`/orders/${returnReq.order_id}`}
                        className="text-menx-primary hover:text-menx-primary-hover font-mono font-bold inline-flex items-center space-x-1 ml-1"
                      >
                        <span>{returnReq.order_number}</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </span>
                  )}
                </div>
              </div>

              {isCancelable && (
                <div className="space-y-1.5">
                  <button
                    disabled={cancelling}
                    onClick={handleCancelRequest}
                    className="py-2.5 px-5 bg-menx-error/10 hover:bg-menx-error/20 text-menx-error hover:text-menx-error border border-menx-error/20 hover:border-menx-error/30 rounded-xl text-xs font-bold transition-all duration-150 uppercase tracking-wider disabled:opacity-50"
                  >
                    {cancelling ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                  {cancelError && (
                    <p className="text-[11px] text-menx-error text-right">{cancelError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Visual Timeline (Hidden for REJECTED/CANCELLED) */}
            {!['REJECTED', 'CANCELLED'].includes(returnReq.status) && (
              <div className="menx-card rounded-2xl p-6 shadow-md space-y-6 text-sm">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
                  <Clock className="w-4 h-4 text-menx-primary mr-2" />
                  <span>Request Status Progress</span>
                </h3>

                <div className="relative">
                  {/* Progress Line */}
                  <div className="absolute top-4 left-4 right-4 h-0.5 bg-menx-surface-elevated -z-10 hidden md:block" />

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
                    {trackingStatuses.map((statusName, idx) => {
                      const event = getStatusEvent(statusName);
                      const isCompleted = !!event || returnReq.status === statusName;
                      const currentStatusIdx = trackingStatuses.indexOf(returnReq.status);
                      const isActive = isCompleted || idx <= currentStatusIdx;

                      return (
                        <div key={statusName} className="flex md:flex-col items-start md:items-center space-x-4 md:space-x-0 md:text-center">
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
                            isActive
                              ? 'bg-menx-primary/15 border-menx-primary text-menx-primary'
                              : 'bg-menx-bg border-menx-border text-menx-text-muted'
                          }`}>
                            {isActive ? (
                              <Check className="w-4 h-4 stroke-[3]" />
                            ) : (
                              <span className="text-xs font-bold">{idx + 1}</span>
                            )}
                          </div>

                          <div className="md:pt-3 space-y-0.5">
                            <h4 className={`font-bold text-xs uppercase tracking-wider ${
                              isActive ? 'text-white' : 'text-menx-text-muted'
                            }`}>
                              {statusName.replace(/_/g, ' ')}
                            </h4>
                            {event && (
                              <p className="text-[10px] text-menx-text-muted font-mono">
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

            {/* Cancelled/Rejected Alert Banner */}
            {returnReq.status === 'CANCELLED' && (
              <div className="bg-menx-surface-elevated border border-menx-border text-menx-text-secondary p-5 rounded-2xl flex items-start space-x-3 shadow-md text-sm">
                <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-menx-text-secondary" />
                <div className="space-y-1">
                  <h4 className="font-bold text-white">Request Cancelled</h4>
                  <p className="text-xs text-menx-text-secondary leading-relaxed font-medium">
                    This request was cancelled. If this was an exchange request, variant inventory reservations have been released.
                  </p>
                </div>
              </div>
            )}

            {returnReq.status === 'REJECTED' && (
              <div className="bg-menx-error/10 border border-menx-error/20 text-menx-error p-5 rounded-2xl flex items-start space-x-3 shadow-md text-sm">
                <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-menx-error" />
                <div className="space-y-1">
                  <h4 className="font-bold text-white">Request Rejected</h4>
                  <p className="text-xs text-menx-text-secondary leading-relaxed font-medium">
                    This return/exchange request was reviewed and rejected. Please see administrator remarks below or contact customer support for further assistance.
                  </p>
                </div>
              </div>
            )}

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start text-sm">
              
              {/* Left Column: Returned Items Cards */}
              <div className="lg:col-span-2 space-y-6">
                <div className="menx-card rounded-2xl p-6 shadow-md space-y-5">
                  <div className="flex items-center justify-between border-b border-menx-border pb-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Package className="w-4 h-4 text-menx-primary" />
                      <span>Returned Items ({(returnReq.items || []).length})</span>
                    </h3>
                  </div>
                  
                  <div className="divide-y divide-gray-855">
                    {(returnReq.items || []).map((item) => {
                      const hasDiscount = Number(item.unit_mrp_snapshot) > Number(item.unit_price_snapshot);
                      const itemTotal = Number(item.item_total || (item.unit_price_snapshot * item.quantity));

                      return (
                        <div key={item.id} className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row gap-5">
                          {/* Product Image Thumbnail */}
                          <div className="w-20 h-24 rounded-xl bg-menx-bg border border-menx-border flex-shrink-0 overflow-hidden flex items-center justify-center relative">
                            {item.primary_image_url ? (
                              <img
                                src={item.primary_image_url}
                                alt={item.product_title_snapshot || 'Product Image'}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <Package className="w-8 h-8 text-menx-text-muted" />
                            )}
                          </div>

                          {/* Item Details */}
                          <div className="flex-1 space-y-2 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {item.brand_name && (
                                <span className="text-[10px] font-bold font-mono tracking-wider text-menx-primary uppercase bg-menx-primary/10 px-2 py-0.5 rounded border border-menx-primary/20">
                                  {item.brand_name}
                                </span>
                              )}
                              {(item.category_name || item.subcategory_name) && (
                                <span className="text-[11px] text-menx-text-secondary">
                                  {item.category_name}{item.subcategory_name ? ` › ${item.subcategory_name}` : ''}
                                </span>
                              )}
                              {!item.product_status && (
                                <span className="text-[10px] font-bold bg-menx-warning/10 border border-menx-warning/20 text-menx-warning px-2 py-0.5 rounded">
                                  Product currently unavailable
                                </span>
                              )}
                            </div>

                            <h4 className="font-bold text-white text-base leading-snug break-words">
                              {item.product_title_snapshot}
                            </h4>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-menx-text-secondary font-mono">
                              <span>SKU: <strong className="text-menx-text">{item.variant_sku_snapshot}</strong></span>
                              <span>•</span>
                              <span>Purchased Size: <strong className="text-menx-primary">{item.size_snapshot}</strong></span>
                              <span>•</span>
                              <span>Color: <strong className="text-menx-text">{item.color_snapshot}</strong></span>
                            </div>

                            {/* Price Snapshot & Quantity */}
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs pt-1 border-t border-menx-border/60">
                              <div className="flex items-center space-x-1.5">
                                <span className="text-menx-text-secondary">Purchase Price:</span>
                                <span className="text-white font-bold font-mono">{formatCurrency(item.unit_price_snapshot)}</span>
                                {hasDiscount && (
                                  <span className="text-menx-text-muted line-through text-[11px] font-mono">
                                    {formatCurrency(item.unit_mrp_snapshot)}
                                  </span>
                                )}
                              </div>
                              <div className="text-menx-text-secondary">
                                Quantity: <strong className="text-white font-mono">{item.quantity}</strong>
                              </div>
                              <div className="text-menx-text-secondary">
                                Item Total: <strong className="text-menx-primary font-mono font-bold">{formatCurrency(itemTotal)}</strong>
                              </div>
                            </div>

                            {/* Replacement details for Exchanges */}
                            {returnReq.request_type === 'EXCHANGE' && (
                              <div className="mt-2.5 p-3 bg-menx-primary/10 border border-menx-primary/20 rounded-xl text-xs space-y-1">
                                <div className="font-bold text-menx-primary flex items-center gap-2">
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Requested Replacement Size:</span>
                                  <span className="bg-menx-primary text-[#0B0F14] px-2 py-0.5 rounded font-black text-xs">
                                    Size {item.replacement_size || 'N/A'}
                                  </span>
                                  {item.replacement_color && <span className="text-menx-text-secondary">({item.replacement_color})</span>}
                                </div>
                                {item.replacement_sku && (
                                  <div className="text-[11px] text-menx-text-secondary font-mono pl-5">
                                    SKU: {item.replacement_sku}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Condition on receipt */}
                            {item.condition_on_receipt && (
                              <div className="pt-1 text-xs text-menx-text-secondary">
                                Inspection Result: <span className="text-white font-bold bg-menx-bg border border-menx-border px-2 py-0.5 rounded font-mono text-[10px]">{item.condition_on_receipt}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Return Terms & Policy Reminder Card */}
                <div className="menx-card rounded-2xl p-6 shadow-md space-y-3 text-xs text-menx-text-secondary">
                  <h4 className="font-bold text-white uppercase tracking-wider text-xs flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-menx-primary" />
                    <span>MENX Return Policy Guidelines</span>
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 leading-relaxed">
                    <li>Items must be unused, unwashed, and in original condition with all brand tags and packaging intact.</li>
                    <li>For size exchanges, replacements are dispatched once pickup or store inspection is verified.</li>
                    <li>Refunds are credited to the original payment method or wallet upon successful inspection.</li>
                  </ul>
                </div>
              </div>

              {/* Right Column: Request Info & Status Logs */}
              <div className="space-y-6">
                
                {/* Reason & Comments card */}
                <div className="menx-card rounded-2xl p-6 space-y-4 shadow-md">
                  <h3 className="font-bold text-white border-b border-menx-border pb-3 uppercase tracking-wider text-xs">Request Information</h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-menx-text-muted font-bold uppercase block text-[10px]">Reason for Return</span>
                      <span className="font-bold text-white text-sm">{returnReq.reason.replace(/_/g, ' ')}</span>
                    </div>

                    {returnReq.customer_comment && (
                      <div>
                        <span className="text-menx-text-muted font-bold uppercase block text-[10px]">Your Remarks</span>
                        <span className="text-menx-text-secondary leading-relaxed font-medium block italic p-3 bg-menx-bg rounded-xl border border-menx-border mt-1">
                          "{returnReq.customer_comment}"
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* History comments log (Admin comments) */}
                <div className="menx-card rounded-2xl p-6 space-y-4 shadow-md">
                  <h3 className="font-bold text-white border-b border-menx-border pb-3 uppercase tracking-wider text-xs flex items-center">
                    <User className="w-3.5 h-3.5 text-menx-primary mr-2" />
                    <span>Status & Review Log</span>
                  </h3>
                  
                  {getAdminNotes().length === 0 ? (
                    <div className="text-xs text-menx-text-muted flex items-start space-x-2">
                      <HelpCircle className="w-4 h-4 text-menx-text-muted mt-0.5 flex-shrink-0" />
                      <span>No review remarks written yet. Your request is being processed.</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {getAdminNotes().map((h) => (
                        <div key={h.id} className="p-3 bg-menx-bg rounded-xl border border-menx-border space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] font-bold text-menx-text-secondary">
                            <span className="text-menx-primary">Status: {h.to_status}</span>
                            <span className="font-mono">{new Date(h.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-xs text-menx-text-secondary font-medium leading-relaxed">
                            "{h.comment}"
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>
        )}

      </div>
    </BaseLayout>
  );
}
