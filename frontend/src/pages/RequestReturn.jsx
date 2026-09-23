import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api.js';
import { Package, RotateCcw, AlertTriangle, ArrowLeft, ChevronRight, ChevronDown, Check, ShieldCheck, FileText } from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';
import { formatCurrency } from '../utils/formatters.js';

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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [formError, setFormError] = useState(null);
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
    setFormError(null);
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
    setFormError(null);

    if (checked && requestType === 'EXCHANGE') {
      fetchVariantsForProduct(productId);
    }
  };

  // Handle quantity adjustment
  const handleQuantityChange = (orderItemId, value, max) => {
    const qty = Math.max(1, Math.min(max, parseInt(value, 10) || 1));
    setSelectedItems(prev => ({
      ...prev,
      [orderItemId]: {
        ...prev[orderItemId],
        quantity: qty
      }
    }));
    setFormError(null);
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
    setFormError(null);
  };

  // Handle type change
  const handleTypeChange = (newType) => {
    setRequestType(newType);
    setFormError(null);
    // Trigger variant pre-fetches if exchange is selected for already checked items
    if (newType === 'EXCHANGE' && selectedOrderId && ordersMap[selectedOrderId]) {
      Object.keys(selectedItems).forEach(orderItemId => {
        if (selectedItems[orderItemId]?.checked) {
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
    setFormError(null);
    
    // Collect selected items
    const requestItems = [];
    if (selectedOrderId && ordersMap[selectedOrderId]) {
      Object.keys(selectedItems).forEach(orderItemId => {
        const selection = selectedItems[orderItemId];
        if (selection?.checked) {
          const itemObj = ordersMap[selectedOrderId].items.find(i => i.orderItemId === orderItemId);
          if (itemObj) {
            requestItems.push({
              orderItemId,
              variantId: itemObj.variantId,
              quantity: parseInt(selection.quantity, 10) || 1,
              replacementVariantId: requestType === 'EXCHANGE' && selection.replacementVariantId ? selection.replacementVariantId : null
            });
          }
        }
      });
    }

    if (requestItems.length === 0) {
      setFormError('Please select at least one item to return or exchange.');
      return;
    }

    if (requestType === 'EXCHANGE') {
      const missingReplacement = requestItems.some(i => !i.replacementVariantId);
      if (missingReplacement) {
        setFormError('Please select a replacement size for all exchange items.');
        return;
      }
    }

    if (!termsAccepted) {
      setFormError('Please accept the Return & Exchange Terms and Conditions to proceed.');
      return;
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
      setFormError(err.message || 'Failed to submit return request. Please check details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedOrderData = ordersMap[selectedOrderId];
  const checkedItemsCount = Object.values(selectedItems).filter(i => i.checked).length;
  const missingExchangeSize = requestType === 'EXCHANGE' && Object.keys(selectedItems).some(
    id => selectedItems[id]?.checked && !selectedItems[id]?.replacementVariantId
  );
  const isSubmitDisabled = submitting || checkedItemsCount === 0 || (requestType === 'EXCHANGE' && missingExchangeSize) || !termsAccepted;

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-grow space-y-8 w-full min-w-0 overflow-x-hidden">
        
        {/* Back link */}
        <Link
          to="/orders"
          className="inline-flex items-center space-x-1.5 text-sm font-semibold text-menx-text-secondary hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Orders</span>
        </Link>

        {/* Title */}
        <div className="border-b border-menx-border pb-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-menx-primary/10 border border-menx-primary/20 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-menx-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Return &amp; Exchange Center</h1>
              <p className="text-xs text-menx-text-secondary mt-0.5">Manage easy returns and size replacements for delivered orders</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-menx-primary"></div>
          </div>
        ) : error ? (
          <div className="bg-menx-error/10 border border-menx-error/20 text-menx-error p-6 rounded-xl text-center space-y-2 max-w-lg mx-auto">
            <AlertTriangle className="w-8 h-8 mx-auto" />
            <p className="font-bold">Failed to load eligible items</p>
            <p className="text-xs text-menx-text-secondary">{error}</p>
          </div>
        ) : Object.keys(ordersMap).length === 0 ? (
          <div className="menx-card p-8 sm:p-12 rounded-2xl text-center text-menx-text-muted space-y-4 max-w-lg mx-auto shadow-lg my-8">
            <div className="w-16 h-16 bg-menx-bg border border-menx-border rounded-full flex items-center justify-center mx-auto">
              <Package className="w-8 h-8 text-menx-text-muted" />
            </div>
            <h3 className="text-white text-lg font-bold">No Eligible Items</h3>
            <p className="text-sm text-menx-text-secondary leading-relaxed">
              You do not have any orders eligible for return or exchange at this time. Returns are permitted within <strong>7 days of delivery</strong> for completed orders.
            </p>
            <div className="pt-2">
              <Link
                to="/orders"
                className="inline-flex items-center space-x-2 py-2.5 px-5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] font-bold rounded-lg transition-colors text-sm"
              >
                <span>View Order History</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8 xl:gap-10 items-start w-full min-w-0">
            
            {/* Left columns: Order & Items selection + Terms & Conditions Accordion */}
            <div className="lg:col-span-2 space-y-6 min-w-0">
              
              {/* Order selector dropdown */}
              <div className="menx-card rounded-2xl p-5 sm:p-6 space-y-3 shadow-md text-sm">
                <label className="block text-xs font-bold text-menx-text-secondary uppercase tracking-wider">
                  Select Order for Return / Exchange
                </label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="w-full bg-menx-bg border border-menx-border rounded-xl p-3 text-white focus:outline-none focus:border-menx-primary font-bold"
                >
                  {Object.keys(ordersMap).map(id => (
                    <option key={id} value={id}>
                      Order #{ordersMap[id].orderNumber} (Delivered: {new Date(ordersMap[id].deliveredAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items listing checkboxes */}
              {selectedOrderData && (
                <div className="menx-card rounded-2xl p-5 sm:p-6 shadow-md space-y-4 text-sm min-w-0">
                  <div className="border-b border-menx-border pb-3 flex items-center justify-between">
                    <h3 className="font-bold text-white text-base">
                      Select Items from Order #{selectedOrderData.orderNumber}
                    </h3>
                    <span className="text-xs text-menx-text-secondary font-mono">
                      {checkedItemsCount} of {selectedOrderData.items.length} selected
                    </span>
                  </div>

                  <div className="divide-y divide-gray-850">
                    {selectedOrderData.items.map((item) => {
                      const selection = selectedItems[item.orderItemId] || { checked: false, quantity: 1, replacementVariantId: '' };
                      const variants = productVariants[item.productId] || [];

                      return (
                        <div key={item.orderItemId} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
                          
                          {/* Item selection details */}
                          <div className="flex items-start space-x-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={selection.checked}
                              onChange={(e) => handleItemCheckToggle(item.orderItemId, item.productId, e.target.checked)}
                              className="rounded text-menx-primary focus:ring-menx-primary bg-menx-bg border-menx-border mt-1 cursor-pointer"
                            />
                            
                            <div className="space-y-1 min-w-0">
                              <h4 className={`font-bold transition-colors line-clamp-2 break-words text-sm sm:text-base ${selection.checked ? 'text-white' : 'text-menx-text-secondary'}`}>
                                {item.productTitle}
                              </h4>
                              <div className="flex flex-wrap gap-2 text-xs text-menx-text-secondary font-mono">
                                <span>SKU: {item.sku}</span>
                                <span>•</span>
                                <span>Size: <strong className="text-menx-text">{item.size}</strong></span>
                                <span>•</span>
                                <span>Color: <strong className="text-menx-text">{item.color}</strong></span>
                              </div>
                              <div className="text-xs text-menx-text-secondary pt-0.5 font-medium flex flex-wrap gap-x-2 gap-y-1">
                                <span>Purchased: <strong className="text-white font-mono">{item.purchasedQuantity}</strong></span>
                                <span>|</span>
                                <span>Already Returned: <strong className="text-white font-mono">{item.returnedQuantity}</strong></span>
                                <span>|</span>
                                <span>Available for Return: <strong className="text-menx-primary font-mono">{item.eligibleQuantity}</strong></span>
                              </div>
                              <div className="text-xs text-menx-primary/90 font-mono font-bold pt-0.5">
                                Price: {formatCurrency(item.unitPrice)}
                              </div>
                            </div>
                          </div>

                          {/* Options if checked */}
                          {selection.checked && (
                            <div className="flex flex-wrap items-center gap-3 sm:justify-end self-end sm:self-center bg-menx-bg/60 sm:bg-transparent p-3 sm:p-0 rounded-lg border sm:border-0 border-menx-border w-full sm:w-auto">
                              
                              {/* Quantity select */}
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-menx-text-secondary font-bold">Qty:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={item.eligibleQuantity}
                                  value={selection.quantity}
                                  onChange={(e) => handleQuantityChange(item.orderItemId, e.target.value, item.eligibleQuantity)}
                                  className="w-16 bg-menx-bg border border-menx-border rounded-lg p-1.5 text-center text-white focus:outline-none focus:border-menx-primary font-mono font-bold text-xs sm:text-sm"
                                />
                              </div>

                              {/* Exchange replacement variant */}
                              {requestType === 'EXCHANGE' && (
                                <div className="flex items-center space-x-2 min-w-0 flex-grow sm:flex-grow-0">
                                  <span className="text-xs text-menx-text-secondary font-bold whitespace-nowrap">New Size:</span>
                                  {loadingVariants[item.productId] ? (
                                    <span className="text-xs text-menx-text-muted animate-pulse">Loading sizes...</span>
                                  ) : (
                                    <select
                                      required
                                      value={selection.replacementVariantId}
                                      onChange={(e) => handleReplacementChange(item.orderItemId, e.target.value)}
                                      className="bg-menx-bg border border-menx-border rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-menx-primary font-bold max-w-[200px] truncate"
                                    >
                                      <option value="">-- Choose Size --</option>
                                      {variants.map(v => {
                                        const sizeName = typeof v.size === 'object' ? (v.size?.name || v.size?.code || 'N/A') : (v.size || 'N/A');
                                        const colorName = typeof v.color === 'object' ? (v.color?.name || '') : (v.color || '');
                                        const isCurrentSize = v.id === item.variantId;
                                        const availableStock = Number(v.availableStock ?? v.quantityAvailable ?? v.quantity_available ?? 0);
                                        const isOut = availableStock <= 0;
                                        const isSelectable = !isCurrentSize && !isOut;

                                        return (
                                          <option key={v.id} value={v.id} disabled={!isSelectable}>
                                            {sizeName} {colorName ? `(${colorName})` : ''} {isCurrentSize ? '(Current Size)' : isOut ? '(Out of Stock)' : `(${availableStock} left)`}
                                          </option>
                                        );
                                      })}
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

              {/* Expandable Return & Exchange Terms and Conditions */}
              <div className="menx-card rounded-2xl overflow-hidden shadow-md">
                <button
                  type="button"
                  onClick={() => setIsTermsOpen(prev => !prev)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-menx-surface-elevated/50 transition-colors"
                  aria-expanded={isTermsOpen}
                >
                  <div className="flex items-center space-x-2.5">
                    <FileText className="w-5 h-5 text-menx-primary flex-shrink-0" />
                    <div>
                      <span className="font-bold text-white text-sm sm:text-base">Return &amp; Exchange Terms and Conditions</span>
                      <p className="text-xs text-menx-text-secondary mt-0.5">Please review the return guidelines and eligibility criteria</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-menx-text-secondary transition-transform duration-200 ${isTermsOpen ? 'rotate-180 text-menx-primary' : ''}`} />
                </button>

                {isTermsOpen && (
                  <div className="p-5 sm:p-6 border-t border-menx-border text-xs sm:text-sm text-menx-text-secondary space-y-5 leading-relaxed bg-menx-bg/40">
                    <div className="text-xs text-menx-text-secondary italic">
                      Please review the following conditions before submitting your return or exchange request.
                    </div>

                    <div className="space-y-4 divide-y divide-gray-850 text-xs sm:text-sm">
                      <div className="pt-3 first:pt-0">
                        <strong className="text-menx-primary block mb-1">1. Eligibility</strong>
                        <ul className="list-disc pl-5 space-y-1 text-menx-text-secondary">
                          <li>Returns and exchanges are available only for eligible products and orders.</li>
                          <li>The order must be within the allowed return/exchange window of <strong>7 days from delivery</strong>.</li>
                          <li>The product must belong to an eligible return category.</li>
                        </ul>
                      </div>

                      <div className="pt-3">
                        <strong className="text-menx-primary block mb-1">2. Product Condition</strong>
                        <ul className="list-disc pl-5 space-y-1 text-menx-text-secondary">
                          <li>Products must be completely unused, unworn, and unwashed.</li>
                          <li>Original tags, labels, and packaging should be intact where applicable.</li>
                          <li>Products showing signs of use, washing, damage, alteration, or misuse will be rejected upon inspection.</li>
                        </ul>
                      </div>

                      <div className="pt-3">
                        <strong className="text-menx-primary block mb-1">3. Size Exchange</strong>
                        <ul className="list-disc pl-5 space-y-1 text-menx-text-secondary">
                          <li>Size exchange is strictly subject to real-time inventory availability.</li>
                          <li>Customer can request an exchange only for an available eligible replacement size.</li>
                          <li>If the requested size is unavailable or out of stock, the exchange request cannot be completed.</li>
                          <li>Exchange quantity cannot exceed the eligible purchased quantity.</li>
                        </ul>
                      </div>

                      <div className="pt-3">
                        <strong className="text-menx-primary block mb-1">4. Refund Returns</strong>
                        <ul className="list-disc pl-5 space-y-1 text-menx-text-secondary">
                          <li>Refunds are processed only after the returned product is received in store and passes physical quality inspection.</li>
                          <li>Refund amount is calculated based on the applicable historical purchase price recorded for the order.</li>
                          <li>Shipping charges are refundable only where MENX applicable policy permits it.</li>
                        </ul>
                      </div>

                      <div className="pt-3">
                        <strong className="text-menx-primary block mb-1">5. Damaged / Incorrect Products</strong>
                        <ul className="list-disc pl-5 space-y-1 text-menx-text-secondary">
                          <li>If MENX delivers a damaged, defective, or incorrect product, the customer should report it through the return portal as soon as possible.</li>
                          <li>MENX may request photographs or additional verification information.</li>
                        </ul>
                      </div>

                      <div className="pt-3">
                        <strong className="text-menx-primary block mb-1">6. Inspection</strong>
                        <ul className="list-disc pl-5 space-y-1 text-menx-text-secondary">
                          <li>All returned products are inspected by store staff before approval.</li>
                          <li>A return/exchange may be rejected if the product does not satisfy the eligibility requirements.</li>
                        </ul>
                      </div>

                      <div className="pt-3">
                        <strong className="text-menx-primary block mb-1">7. Exchange Processing</strong>
                        <ul className="list-disc pl-5 space-y-1 text-menx-text-secondary">
                          <li>Once an exchange is approved, the replacement product will be processed subject to inventory availability.</li>
                          <li>Exchange processing may require pickup and delivery transit time.</li>
                        </ul>
                      </div>

                      <div className="pt-3">
                        <strong className="text-menx-primary block mb-1">8. Non-Returnable Situations</strong>
                        <p className="text-menx-text-secondary mb-1">Returns/exchanges may not be accepted when:</p>
                        <ul className="list-disc pl-5 space-y-1 text-menx-text-secondary">
                          <li>Product has been used or washed.</li>
                          <li>Product has been damaged by the customer.</li>
                          <li>Product tags have been removed where tags are required.</li>
                          <li>Product has been altered or modified.</li>
                          <li>Return request is outside the permitted 7-day return period.</li>
                          <li>Product/category is explicitly marked non-returnable.</li>
                        </ul>
                      </div>

                      <div className="pt-3">
                        <strong className="text-menx-primary block mb-1">9. Customer Responsibility</strong>
                        <ul className="list-disc pl-5 space-y-1 text-menx-text-secondary">
                          <li>Customer must provide accurate return information.</li>
                          <li>Customer must select the correct item, quantity, return reason, and exchange size where applicable.</li>
                        </ul>
                      </div>

                      <div className="pt-3">
                        <strong className="text-menx-primary block mb-1">10. Final Approval</strong>
                        <ul className="list-disc pl-5 space-y-1 text-menx-text-secondary">
                          <li>Submitting a return request does not automatically guarantee approval.</li>
                          <li>MENX reserves the right to verify eligibility according to the applicable return policy.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Right column: Form details, Terms Acceptance & Submit */}
            <div className="space-y-6 min-w-0">
              
              <div className="menx-card rounded-2xl p-5 sm:p-6 shadow-xl space-y-5 text-sm min-w-0">
                <h3 className="font-extrabold text-white border-b border-menx-border pb-3 text-base">Request Options</h3>

                {/* Request Type Toggle */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-menx-text-secondary uppercase tracking-wider">Request Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleTypeChange('RETURN')}
                      className={`p-3 rounded-xl border font-bold text-center transition-all ${
                        requestType === 'RETURN'
                          ? 'border-menx-primary bg-menx-primary/10 text-menx-primary shadow-sm'
                          : 'border-menx-border bg-menx-bg text-menx-text-secondary hover:text-white'
                      }`}
                    >
                      Refund Return
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('EXCHANGE')}
                      className={`p-3 rounded-xl border font-bold text-center transition-all ${
                        requestType === 'EXCHANGE'
                          ? 'border-menx-primary bg-menx-primary/10 text-menx-primary shadow-sm'
                          : 'border-menx-border bg-menx-bg text-menx-text-secondary hover:text-white'
                      }`}
                    >
                      Size Exchange
                    </button>
                  </div>
                </div>

                {/* Reason Dropdown */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-menx-text-secondary uppercase tracking-wider">Reason for Return</label>
                  <select
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setFormError(null);
                    }}
                    className="w-full bg-menx-bg border border-menx-border rounded-xl p-3 text-white focus:outline-none focus:border-menx-primary font-bold"
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
                  <label className="text-xs font-bold text-menx-text-secondary uppercase tracking-wider">Customer Remarks (Optional)</label>
                  <textarea
                    rows={3}
                    value={customerComment}
                    onChange={(e) => {
                      setCustomerComment(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="Provide additional details regarding return condition or replacement preferences..."
                    className="w-full bg-menx-bg border border-menx-border rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary transition-all font-medium text-xs sm:text-sm"
                  />
                </div>

                {/* Terms Acceptance Checkbox */}
                <div className="pt-3 border-t border-menx-border space-y-2">
                  <div className="flex items-start space-x-3">
                    <input
                      id="terms-checkbox"
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => {
                        setTermsAccepted(e.target.checked);
                        if (e.target.checked && formError?.includes('Terms and Conditions')) {
                          setFormError(null);
                        }
                      }}
                      className="mt-1 h-4 w-4 rounded border-menx-border bg-menx-bg text-menx-primary focus:ring-menx-primary cursor-pointer"
                    />
                    <label htmlFor="terms-checkbox" className="text-xs text-menx-text-secondary leading-snug cursor-pointer select-none">
                      I have read and agree to the{' '}
                      <button
                        type="button"
                        onClick={() => setIsTermsOpen(true)}
                        className="text-menx-primary hover:text-menx-primary-hover font-semibold underline underline-offset-2"
                      >
                        Return &amp; Exchange Terms and Conditions
                      </button>
                      .
                    </label>
                  </div>
                </div>

                {/* Error Banner */}
                {formError && (
                  <div className="bg-menx-error/10 border border-menx-error/25 text-menx-error p-3 rounded-xl text-xs flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="leading-snug">{formError}</span>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className="w-full py-3.5 bg-menx-primary hover:bg-menx-primary-hover disabled:bg-menx-surface-elevated disabled:text-menx-text-muted text-[#0B0F14] font-extrabold rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-menx-primary/10 cursor-pointer disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-black" />
                  ) : (
                    <>
                      <span>Submit Return Request</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Quick Help / Trust Badge */}
                <div className="flex items-center justify-center space-x-2 text-[11px] text-menx-text-muted pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-menx-primary/80" />
                  <span>Verified 7-Day MENX Quality Guarantee</span>
                </div>

              </div>

            </div>

          </form>
        )}

      </div>
    </BaseLayout>
  );
}

