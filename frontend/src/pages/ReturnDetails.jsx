import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api.js';
import { RotateCcw, Calendar, ArrowLeft, Check, AlertTriangle, Clock, HelpCircle, User } from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';

export default function ReturnDetails() {
  const { returnId } = useParams();
  const [returnReq, setReturnReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  async function loadReturnDetails() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/returns/${returnId}`);
      setReturnReq(res.data);
    } catch (err) {
      console.error('Failed to load return details:', err.message);
      setError(err.message);
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
    try {
      await api.post(`/returns/${returnId}/cancel`);
      await loadReturnDetails(); // Reload to show cancelled status
    } catch (err) {
      alert(err.message || 'Failed to cancel return request');
    } finally {
      setCancelling(false);
    }
  };

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow space-y-8">
        
        {/* Back link */}
        <Link
          to="/returns"
          className="inline-flex items-center space-x-1.5 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to returns list</span>
        </Link>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500"></div>
          </div>
        ) : error || !returnReq ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-xl text-center space-y-2 max-w-lg mx-auto">
            <AlertTriangle className="w-8 h-8 mx-auto" />
            <p className="font-bold">Failed to load return details</p>
            <p className="text-xs text-gray-400">{error || 'Request not found'}</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Overview Panel */}
            <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-md">
              <div className="space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-black text-white">Return Request {returnReq.return_number}</h2>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(returnReq.status)}`}>
                    {returnReq.status}
                  </span>
                  <span className="text-[10px] font-bold bg-gray-850 border border-gray-800 text-gray-400 px-2 py-0.5 rounded uppercase">
                    {returnReq.request_type}
                  </span>
                </div>
                <div className="flex items-center text-xs text-gray-400 space-x-4">
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-500" />
                    <span>Requested: {new Date(returnReq.created_at).toLocaleString()}</span>
                  </span>
                </div>
              </div>

              {isCancelable && (
                <button
                  disabled={cancelling}
                  onClick={handleCancelRequest}
                  className="py-2.5 px-5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 rounded-xl text-xs font-bold transition-all duration-150 uppercase tracking-wider"
                >
                  Cancel Request
                </button>
              )}
            </div>

            {/* Visual Timeline (Hidden for REJECTED/CANCELLED) */}
            {!['REJECTED', 'CANCELLED'].includes(returnReq.status) && (
              <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 shadow-md space-y-6 text-sm">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
                  <Clock className="w-4 h-4 text-amber-500 mr-1.5" />
                  <span>Request Status Progress</span>
                </h3>

                <div className="relative">
                  {/* Progress Line */}
                  <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-850 -z-10 hidden md:block" />

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
                              ? 'bg-amber-500/15 border-amber-500 text-amber-400'
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
                              <p className="text-[10px] text-gray-500 font-mono">
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
              <div className="bg-gray-850 border border-gray-800 text-gray-400 p-5 rounded-2xl flex items-start space-x-3 shadow-md text-sm">
                <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-bold text-white">Request Cancelled</h4>
                  <p className="text-xs text-gray-400 leading-relaxed font-medium">
                    This request was cancelled by you. If this was an exchange request, variant inventory reservations have been released.
                  </p>
                </div>
              </div>
            )}

            {returnReq.status === 'REJECTED' && (
              <div className="bg-red-500/5 border border-red-500/20 text-red-400 p-5 rounded-2xl flex items-start space-x-3 shadow-md text-sm">
                <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-bold text-white">Request Rejected</h4>
                  <p className="text-xs text-gray-400 leading-relaxed font-medium">
                    This request was rejected by store administrators. Please check the logs below for specific condition remarks or support contact details.
                  </p>
                </div>
              </div>
            )}

            {/* Return details list */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start text-sm">
              
              {/* Items List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 shadow-md space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-gray-800 pb-3">Items Requested</h3>
                  
                  <div className="divide-y divide-gray-850">
                    {(returnReq.items || []).map((item) => (
                      <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex gap-4 items-center justify-between">
                        <div className="space-y-1">
                          <h4 className="font-bold text-white">{item.product_title_snapshot}</h4>
                          <div className="flex flex-wrap gap-2 text-xs text-gray-500 font-mono">
                            <span>SKU: {item.variant_sku_snapshot}</span>
                            <span>•</span>
                            <span>Color: {item.color_snapshot}</span>
                            <span>•</span>
                            <span>Original Size: {item.size_snapshot}</span>
                          </div>
                          
                          {/* Replacement details for Exchanges */}
                          {returnReq.request_type === 'EXCHANGE' && item.replacement_variant_id && (
                            <div className="text-xs text-amber-500 font-bold bg-amber-500/5 border border-amber-500/10 px-2 py-1 rounded inline-block mt-1.5">
                              Exchanging for: Size {item.replacement_size || 'N/A'} {item.replacement_color && `(${item.replacement_color})`}
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-white">Qty: {item.quantity}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Remarks/Status history comment notes */}
              <div className="space-y-6">
                
                {/* Reason & Comments card */}
                <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 space-y-4 shadow-md">
                  <h3 className="font-bold text-white border-b border-gray-800 pb-3 uppercase tracking-wider text-xs">Request Info</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-gray-500 font-bold uppercase block">Reason</span>
                      <span className="font-medium text-white">{returnReq.reason.replace(/_/g, ' ')}</span>
                    </div>

                    {returnReq.customer_comment && (
                      <div>
                        <span className="text-xs text-gray-500 font-bold uppercase block">Customer Remarks</span>
                        <span className="text-xs text-gray-400 leading-relaxed font-medium block italic p-2 bg-gray-950 rounded-lg border border-gray-850 mt-1">
                          "{returnReq.customer_comment}"
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* History comments log (Admin comments) */}
                <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 space-y-4 shadow-md">
                  <h3 className="font-bold text-white border-b border-gray-800 pb-3 uppercase tracking-wider text-xs flex items-center">
                    <User className="w-3.5 h-3.5 text-amber-500 mr-1.5" />
                    <span>Review Log</span>
                  </h3>
                  
                  {getAdminNotes().length === 0 ? (
                    <div className="text-xs text-gray-500 flex items-start space-x-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-gray-600 mt-0.5" />
                      <span>No review remarks written by administrators yet.</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {getAdminNotes().map((h) => (
                        <div key={h.id} className="p-3 bg-gray-950 rounded-xl border border-gray-850 space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
                            <span>Status: {h.to_status}</span>
                            <span className="font-mono">{new Date(h.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-xs text-gray-300 font-medium">
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
