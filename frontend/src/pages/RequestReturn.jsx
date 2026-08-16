import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api.js';
import { Package, RotateCcw, AlertTriangle, ArrowLeft, ChevronRight, Check } from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';

export default function RequestReturn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialOrderId = searchParams.get('orderId') || '';

  // Data states
  const [eligibleItems, setEligibleItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Grouped items
  const [ordersMap, setOrdersMap] = useState({});
  const [selectedOrderId, setSelectedOrderId] = useState(initialOrderId);

  // Form states
  const [requestType, setRequestType] = useState('RETURN'); // 'RETURN' | 'EXCHANGE'
  const [reason, setReason] = useState('WRONG_SIZE');
  const [customerComment, setCustomerComment] = useState('');
  const [selectedItems, setSelectedItems] = useState({}); // orderItemId -> { checked: boolean, quantity: number, replacementVariantId: string }
  const [submitting, setSubmitting] = useState(false);

  // Variant size selection maps for exchanges: productId -> [variant objects]
  const [productVariants, setProductVariants] = useState({});
  const [loadingVariants, setLoadingVariants] = useState({});

  useEffect(() => {
    async function loadEligibleItems() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/returns/eligible-items');
        const items = res.data || [];
        setEligibleItems(items);

        // Group items by orderId
        const groups = {};
        items.forEach(item => {
          if (!groups[item.orderId]) {
            groups[item.orderId] = {
              orderNumber: item.orderNumber,
              deliveredAt: item.deliveredAt,
              items: []
            };
          }
          groups[item.orderId].items.push(item);
        });
        setOrdersMap(groups);

        // Auto-select order if query param exists and is valid
        if (initialOrderId && groups[initialOrderId]) {
          setSelectedOrderId(initialOrderId);
        } else if (Object.keys(groups).length > 0) {
          setSelectedOrderId(Object.keys(groups)[0]);
        }
      } catch (err) {
        console.error('Failed to load return items:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadEligibleItems();
  }, [initialOrderId]);

  // Fetch product variants for exchange items
  const fetchVariantsForProduct = async (productId) => {
    if (productVariants[productId] || loadingVariants[productId]) return;
    setLoadingVariants(prev => ({ ...prev, [productId]: true }));
    try {
      const res = await api.get(`/products/${productId}/variants`);
      const variants = (res.data || []).filter(v => v.isActive || v.is_active);
      setProductVariants(prev => ({ ...prev, [productId]: variants }));
    } catch (err) {
      console.error(`Failed to fetch variants for product ${productId}:`, err.message);
    } finally {
      setLoadingVariants(prev => ({ ...prev, [productId]: false }));
    }
  };

  // Initialize selected items form state when selected order changes
  useEffect(() => {
    if (!selectedOrderId || !ordersMap[selectedOrderId]) {
      setSelectedItems({});
      return;
    }

    const initialSelections = {};
    ordersMap[selectedOrderId].items.forEach(item => {
      initialSelections[item.orderItemId] = {
        checked: false,
        quantity: 1,
        replacementVariantId: ''
      };
    });
    setSelectedItems(initialSelections);
  }, [selectedOrderId, ordersMap]);

  // Handle item select checkbox toggle
  const handleItemCheckToggle = (orderItemId, productId, checked) => {
    setSelectedItems(prev => ({
      ...prev,
      [orderItemId]: {
        ...prev[orderItemId],
        checked
      }
    }));

    if (checked && requestType === 'EXCHANGE') {
      fetchVariantsForProduct(productId);
    }
  };

  // Handle quantity adjustment
  const handleQuantityChange = (orderItemId, value, max) => {
    const qty = Math.max(1, Math.min(max, parseInt(value) || 1));
    setSelectedItems(prev => ({
      ...prev,
      [orderItemId]: {
        ...prev[orderItemId],
        quantity: qty
      }
    }));
  };

  // Handle replacement variant selection
  const handleReplacementChange = (orderItemId, variantId) => {
    setSelectedItems(prev => ({
      ...prev,
      [orderItemId]: {
        ...prev[orderItemId],
        replacementVariantId: variantId
      }
    }));
  };

  // Handle type change
  const handleTypeChange = (newType) => {
    setRequestType(newType);
    // Trigger variant pre-fetches if exchange is selected for already checked items
    if (newType === 'EXCHANGE') {
      Object.keys(selectedItems).forEach(orderItemId => {
        if (selectedItems[orderItemId].checked) {
          const item = ordersMap[selectedOrderId].items.find(i => i.orderItemId === orderItemId);
          if (item) {
            fetchVariantsForProduct(item.productId);
          }
        }
      });
    }
  };

  // Submit request
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Collect selected items
    const requestItems = [];
    Object.keys(selectedItems).forEach(orderItemId => {
      const selection = selectedItems[orderItemId];
      if (selection.checked) {
        const itemObj = ordersMap[selectedOrderId].items.find(i => i.orderItemId === orderItemId);
        if (itemObj) {
          requestItems.push({
            orderItemId,
            variantId: itemObj.variantId,
            quantity: selection.quantity,
            replacementVariantId: requestType === 'EXCHANGE' ? selection.replacementVariantId : null
          });
        }
      }
    });

    if (requestItems.length === 0) {
      alert('Please select at least one item to return/exchange.');
      return;
    }

    if (requestType === 'EXCHANGE') {
      const missingReplacement = requestItems.some(i => !i.replacementVariantId);
      if (missingReplacement) {
        alert('Please select a replacement size for all exchange items.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await api.post('/returns', {
        orderId: selectedOrderId,
        requestType,
        reason,
        customerComment: customerComment.trim() || null,
        items: requestItems
      });
      navigate('/returns');
    } catch (err) {
      alert(err.message || 'Failed to submit return request');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedOrderData = ordersMap[selectedOrderId];

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow space-y-8">
        
        {/* Back link */}
        <Link
          to="/orders"
          className="inline-flex items-center space-x-1.5 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to orders</span>
        </Link>

        {/* Title */}
        <div className="border-b border-gray-800 pb-6 flex items-center space-x-2">
          <RotateCcw className="w-8 h-8 text-amber-500" />
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Return & Exchange center</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-xl text-center space-y-2 max-w-lg mx-auto">
            <AlertTriangle className="w-8 h-8 mx-auto" />
            <p className="font-bold">Failed to load eligible items</p>
            <p className="text-xs text-gray-400">{error}</p>
          </div>
        ) : Object.keys(ordersMap).length === 0 ? (
          <div className="bg-gray-900 border border-gray-850 p-12 rounded-xl text-center text-gray-500 space-y-4 max-w-lg mx-auto shadow-lg">
            <Package className="w-12 h-12 mx-auto text-gray-700" />
            <h3 className="text-white text-lg font-bold">No Eligible Items</h3>
            <p className="text-sm text-gray-400 leading-relaxed font-medium">
              You do not have any orders eligible for return or exchange at this time. Returns are only allowed within **7 days of delivery** for successfully completed orders.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
            
            {/* Left columns: Order & Items selection */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Order selector dropdown */}
              <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 space-y-4 shadow-md text-sm">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Select Order for return/exchange
                </label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-850 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 font-bold"
                >
                  {Object.keys(ordersMap).map(id => (
                    <option key={id} value={id}>
                      Order {ordersMap[id].orderNumber} (Delivered: {new Date(ordersMap[id].deliveredAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items listing checkboxes */}
              {selectedOrderData && (
                <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 shadow-md space-y-4 text-sm">
                  <h3 className="font-bold text-white border-b border-gray-800 pb-3">
                    Select Items from Order #{selectedOrderData.orderNumber}
                  </h3>

                  <div className="divide-y divide-gray-850">
                    {selectedOrderData.items.map((item) => {
                      const selection = selectedItems[item.orderItemId] || { checked: false, quantity: 1, replacementVariantId: '' };
                      const variants = productVariants[item.productId] || [];

                      return (
                        <div key={item.orderItemId} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          
                          {/* Item selection details */}
                          <div className="flex items-start space-x-3">
                            <input
                              type="checkbox"
                              checked={selection.checked}
                              onChange={(e) => handleItemCheckToggle(item.orderItemId, item.productId, e.target.checked)}
                              className="rounded text-amber-500 focus:ring-amber-500 bg-gray-950 border-gray-800 mt-1"
                            />
                            
                            <div className="space-y-1">
                              <h4 className={`font-bold transition-colors ${selection.checked ? 'text-white' : 'text-gray-400'}`}>
                                {item.productTitle}
                              </h4>
                              <div className="flex flex-wrap gap-2 text-xs text-gray-500 font-mono">
                                <span>SKU: {item.sku}</span>
                                <span>•</span>
                                <span>Size: {item.size}</span>
                                <span>•</span>
                                <span>Color: {item.color}</span>
                              </div>
                              <div className="text-xs text-gray-400 font-bold">
                                Purchase Price: ₹{item.unitPrice} | Remaining: {item.eligibleQuantity} / {item.purchasedQuantity}
                              </div>
                            </div>
                          </div>

                          {/* Options if checked */}
                          {selection.checked && (
                            <div className="flex flex-wrap items-center gap-4 sm:justify-end self-end sm:self-center">
                              
                              {/* Quantity select */}
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500 font-bold">Qty:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={item.eligibleQuantity}
                                  value={selection.quantity}
                                  onChange={(e) => handleQuantityChange(item.orderItemId, e.target.value, item.eligibleQuantity)}
                                  className="w-16 bg-gray-950 border border-gray-850 rounded-lg p-1.5 text-center text-white focus:outline-none focus:border-amber-500 font-mono font-bold"
                                />
                              </div>

                              {/* Exchange replacement variant */}
                              {requestType === 'EXCHANGE' && (
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-500 font-bold">New Size:</span>
                                  {loadingVariants[item.productId] ? (
                                    <span className="text-xs text-gray-600 animate-pulse">Loading sizes...</span>
                                  ) : (
                                    <select
                                      required
                                      value={selection.replacementVariantId}
                                      onChange={(e) => handleReplacementChange(item.orderItemId, e.target.value)}
                                      className="bg-gray-950 border border-gray-850 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                                    >
                                      <option value="">-- Choose Size --</option>
                                      {variants.map(v => (
                                        <option key={v.id} value={v.id}>
                                          {v.size} {v.color && `(${v.color})`} {Number(v.quantityAvailable || v.quantity_available) <= 0 ? '(Out of Stock)' : ''}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              )}

                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* Right column: Form details & Submit */}
            <div className="space-y-6">
              
              <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 shadow-md space-y-6 text-sm">
                <h3 className="font-extrabold text-white border-b border-gray-800 pb-3">Request Options</h3>

                {/* Request Type Toggle */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Request Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleTypeChange('RETURN')}
                      className={`p-3 rounded-xl border font-bold text-center transition-all ${
                        requestType === 'RETURN'
                          ? 'border-amber-500 bg-amber-500/5 text-amber-500'
                          : 'border-gray-850 bg-gray-950 text-gray-500 hover:text-white'
                      }`}
                    >
                      Refund Return
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('EXCHANGE')}
                      className={`p-3 rounded-xl border font-bold text-center transition-all ${
                        requestType === 'EXCHANGE'
                          ? 'border-amber-500 bg-amber-500/5 text-amber-500'
                          : 'border-gray-850 bg-gray-950 text-gray-500 hover:text-white'
                      }`}
                    >
                      Size Exchange
                    </button>
                  </div>
                </div>

                {/* Reason Dropdown */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Reason for Return</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-850 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 font-bold"
                  >
                    <option value="WRONG_SIZE">Wrong Size / Fit Issue</option>
                    <option value="DEFECTIVE">Defective / Damaged Item</option>
                    <option value="NOT_AS_DESCRIBED">Item Not As Described</option>
                    <option value="CHANGED_MIND">Changed My Mind</option>
                    <option value="QUALITY_ISSUE">Product Quality Issue</option>
                    <option value="OTHER">Other / Miscellaneous</option>
                  </select>
                </div>

                {/* Comments Textbox */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Customer Remarks (Optional)</label>
                  <textarea
                    rows={4}
                    value={customerComment}
                    onChange={(e) => setCustomerComment(e.target.value)}
                    placeholder="Provide additional details regarding return condition or replacement preferences..."
                    className="w-full bg-gray-950 border border-gray-850 rounded-xl p-3 text-white placeholder-gray-650 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-medium"
                  />
                </div>

                <hr className="border-gray-850" />

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-850 disabled:text-gray-500 text-black font-extrabold rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 text-sm uppercase tracking-wider shadow-lg"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-black" />
                  ) : (
                    <>
                      <span>Submit Request</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>

              </div>

            </div>

          </form>
        )}

      </div>
    </BaseLayout>
  );
}
