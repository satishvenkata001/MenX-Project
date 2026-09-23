import React, { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../utils/api.js';
import { MapPin, Plus, Percent, CreditCard, Sparkles, Check, ChevronRight, X, AlertCircle, ShoppingBag } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';
import Modal from '../components/Modal.jsx';
import { formatCurrency } from '../utils/formatters.js';

export default function Checkout() {
  const { cart, refreshCart } = useCart();
  const navigate = useNavigate();

  // Address states
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  
  // New Address Modal form states
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressType, setAddressType] = useState('HOME');
  const [isDefault, setIsDefault] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);

  // Coupon states
  const [couponCode, setCouponCode] = useState('');
  const [activeCoupon, setActiveCoupon] = useState('');
  
  // Checkout totals validation states
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [validationError, setValidationError] = useState(null);

  // Place order states
  const [submitting, setSubmitting] = useState(false);
  const [customerNotes, setCustomerNotes] = useState('');
  const [orderError, setOrderError] = useState(null);

  // Fetch customer addresses on load
  async function fetchAddresses() {
    setLoadingAddresses(true);
    try {
      const res = await api.get('/addresses');
      const addressList = res.data || [];
      setAddresses(addressList);
      
      // Auto-select default address or first address
      if (addressList.length > 0) {
        const defaultAddr = addressList.find(a => a.isDefault);
        setSelectedAddressId(defaultAddr ? defaultAddr.id : addressList[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch addresses:', err.message);
    } finally {
      setLoadingAddresses(false);
    }
  }

  useEffect(() => {
    fetchAddresses();
  }, []);

  // Checkout validation request sequence tracker
  const activeValidationReqId = React.useRef(0);

  // Validate checkout whenever selected address or active coupon changes
  useEffect(() => {
    if (!selectedAddressId) {
      setValidationResult(null);
      setValidationError(null);
      return;
    }

    const reqId = ++activeValidationReqId.current;

    async function runCheckoutValidation() {
      setValidating(true);
      setValidationError(null);
      try {
        const payload = {
          addressId: selectedAddressId
        };
        if (activeCoupon && activeCoupon.trim()) {
          payload.couponCode = activeCoupon.trim();
        }
        const res = await api.post('/checkout/validate', payload);
        if (reqId === activeValidationReqId.current) {
          setValidationResult(res.data);
        }
      } catch (err) {
        if (reqId === activeValidationReqId.current) {
          setValidationError(err.message || 'Checkout validation failed');
          setValidationResult(null);
        }
      } finally {
        if (reqId === activeValidationReqId.current) {
          setValidating(false);
        }
      }
    }

    runCheckoutValidation();
  }, [selectedAddressId, activeCoupon]);

  // Handle adding new address
  const handleAddAddressSubmit = async (e) => {
    e.preventDefault();
    if (!recipientName || !phoneNumber || !addressLine1 || !city || !state || !postalCode) {
      alert('Please fill out all required fields.');
      return;
    }

    setAddingAddress(true);
    try {
      const res = await api.post('/addresses', {
        recipientName,
        phoneNumber,
        alternatePhone: alternatePhone || null,
        addressLine1,
        addressLine2: addressLine2 || null,
        landmark: landmark || null,
        city,
        state,
        postalCode,
        addressType,
        isDefault
      });
      
      const newAddr = res.data;
      setAddresses(prev => [newAddr, ...prev]);
      setSelectedAddressId(newAddr.id);
      
      // Reset form states
      setRecipientName('');
      setPhoneNumber('');
      setAlternatePhone('');
      setAddressLine1('');
      setAddressLine2('');
      setLandmark('');
      setCity('');
      setState('');
      setPostalCode('');
      setAddressType('HOME');
      setIsDefault(false);
      setShowAddressModal(false);
    } catch (err) {
      alert(err.message || 'Failed to add address');
    } finally {
      setAddingAddress(false);
    }
  };

  // Coupon handling
  const handleApplyCoupon = (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setActiveCoupon(couponCode.trim().toUpperCase());
  };

  const handleClearCoupon = () => {
    setCouponCode('');
    setActiveCoupon('');
  };

  // Place order
  const handlePlaceOrder = async () => {
    if (submitting || validating) return;
    if (!selectedAddressId) {
      alert('Please select a shipping address.');
      return;
    }
    if (validationError) {
      alert('Please resolve delivery errors before placing order.');
      return;
    }

    setSubmitting(true);
    setOrderError(null);
    try {
      const payload = {
        addressId: selectedAddressId,
        paymentMethod: 'COD'
      };
      if (activeCoupon && activeCoupon.trim()) {
        payload.couponCode = activeCoupon.trim();
      }
      if (customerNotes && customerNotes.trim()) {
        payload.customerNotes = customerNotes.trim();
      }

      const res = await api.post('/orders', payload);
      
      // Refresh cart to empty state
      await refreshCart();
      
      // Redirect to success view
      const createdOrderId = res.data.order_id || res.data.orderId || res.data.id || res.data.order?.id;
      navigate(`/order-success/${createdOrderId}`);
    } catch (err) {
      setOrderError(err.message || 'Order creation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const hasCartItems = cart && cart.items && cart.items.length > 0;

  if (!hasCartItems && !submitting) {
    return (
      <BaseLayout>
        <div className="max-w-md mx-auto my-20 p-8 bg-menx-surface border border-menx-border rounded-2xl text-center space-y-4 shadow-2xl">
          <ShoppingBag className="w-12 h-12 mx-auto text-menx-text-muted animate-pulse" />
          <h2 className="text-xl font-bold tracking-tight text-white">Your Cart is Empty</h2>
          <p className="text-sm text-menx-text-secondary">
            You must have designer items in your shopping cart to validate and checkout.
          </p>
          <Link
            to="/"
            className="inline-flex items-center space-x-2 py-2.5 px-6 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] text-sm font-bold rounded-lg transition-colors duration-200"
          >
            <span>Browse Products</span>
          </Link>
        </div>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow space-y-8">
        
        {/* Checkout Header */}
        <div className="border-b border-menx-border pb-6 flex items-center space-x-2">
          <CreditCard className="w-8 h-8 text-menx-primary" />
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Secure Checkout</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
          
          {/* Checkout Steps */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Step 1: Address Selection */}
            <div className="menx-card rounded-2xl p-6 space-y-4 shadow-md">
              <div className="flex justify-between items-center border-b border-menx-border pb-3">
                <h3 className="text-lg font-bold text-white flex items-center">
                  <MapPin className="w-5 h-5 text-menx-primary mr-2" />
                  <span>1. Delivery Address</span>
                </h3>
                <button
                  onClick={() => setShowAddressModal(true)}
                  className="inline-flex items-center text-xs font-bold text-menx-primary hover:text-menx-primary space-x-1 transition-colors duration-150"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Address</span>
                </button>
              </div>

              {loadingAddresses ? (
                <div className="py-6 flex justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-menx-primary"></div>
                </div>
              ) : addresses.length === 0 ? (
                <div className="p-8 text-center text-menx-text-muted border border-dashed border-menx-border rounded-xl space-y-3">
                  <p className="text-sm">No delivery addresses found on your profile.</p>
                  <button
                    onClick={() => setShowAddressModal(true)}
                    className="py-2 px-4 bg-menx-primary/10 hover:bg-menx-primary/20 text-menx-primary border border-menx-primary/20 rounded-lg text-xs font-bold transition-all"
                  >
                    Create Address Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {addresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.id;
                    return (
                      <div
                        key={addr.id}
                        onClick={() => setSelectedAddressId(addr.id)}
                        className={`p-4 rounded-xl cursor-pointer transition-all duration-200 flex items-start space-x-3 relative group ${
                          isSelected
                            ? 'border border-menx-primary bg-gradient-to-br from-menx-primary/10 via-menx-surface to-menx-surface shadow-md shadow-menx-primary/5'
                            : 'menx-card hover:border-menx-border'
                        }`}
                      >
                        <div className="pt-0.5">
                          <input
                            type="radio"
                            name="selectedAddress"
                            checked={isSelected}
                            onChange={() => setSelectedAddressId(addr.id)}
                            className="text-menx-primary focus:ring-menx-primary bg-menx-surface border-menx-border"
                          />
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="font-bold text-white flex items-center space-x-2">
                            <span>{addr.recipientName}</span>
                            <span className="text-[10px] bg-menx-surface-elevated border border-menx-border text-menx-text-secondary px-1.5 py-0.5 rounded font-mono">
                              {addr.addressType}
                            </span>
                            {addr.isDefault && (
                              <span className="text-[9px] bg-menx-primary/10 text-menx-primary border border-menx-primary/20 px-1.5 py-0.5 rounded font-bold">
                                DEFAULT
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-menx-text-secondary font-mono leading-relaxed">
                            {addr.addressLine1}
                            {addr.addressLine2 && `, ${addr.addressLine2}`}
                            {addr.landmark && ` (Near ${addr.landmark})`}
                            <br />
                            {addr.city}, {addr.state} - <span className="font-bold text-menx-primary/80">{addr.postalCode}</span>
                          </div>
                          <div className="text-xs text-menx-text-secondary pt-1">
                            Phone: {addr.phoneNumber}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2: Payment Details (COD Only) */}
            <div className="menx-card rounded-2xl p-6 space-y-4 shadow-md">
              <h3 className="text-lg font-bold text-white flex items-center border-b border-menx-border pb-3">
                <CreditCard className="w-5 h-5 text-menx-primary mr-2" />
                <span>2. Payment Option</span>
              </h3>
              
              <div className="p-4 border border-menx-primary/20 bg-menx-primary/5 rounded-xl flex items-start space-x-3">
                <div className="w-5 h-5 rounded-full bg-menx-primary flex items-center justify-center text-[#0B0F14] flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <div className="space-y-1 text-sm">
                  <h4 className="font-bold text-white">Cash on Delivery (COD)</h4>
                  <p className="text-xs text-menx-text-secondary">
                    Pay securely using cash or QR scan when your parcel reaches your doorstep. Note: Cash handling fees are waived for Phase 4I.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3: Customer Instructions / Notes */}
            <div className="menx-card rounded-2xl p-6 space-y-4 shadow-md">
              <h3 className="text-lg font-bold text-white flex items-center border-b border-menx-border pb-3">
                <span>3. Customer Instructions (Optional)</span>
              </h3>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="E.g., Please leave package with security guard, or call before delivery..."
                rows={3}
                className="w-full bg-menx-bg border border-menx-border rounded-xl p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary transition-all font-medium"
              />
            </div>
            
          </div>

          {/* Pricing Summary (Right Column) */}
          <div className="space-y-6">
            
            {/* Coupon Code Entry */}
            <div className="menx-card rounded-2xl p-5 space-y-3 shadow-md">
              <label className="text-xs font-bold text-menx-text-secondary uppercase tracking-wider flex items-center">
                <Percent className="w-4 h-4 text-menx-primary mr-1.5" />
                <span>Apply Promo Code</span>
              </label>

              {activeCoupon ? (
                <div className="flex justify-between items-center bg-menx-primary/10 border border-menx-primary/20 p-2.5 rounded-lg text-sm">
                  <div className="flex items-center space-x-1.5 text-menx-primary font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>{activeCoupon} Applied</span>
                  </div>
                  <button
                    onClick={handleClearCoupon}
                    className="p-1 rounded bg-menx-bg border border-menx-border text-menx-text-secondary hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="E.g., FIRST50"
                    className="flex-grow bg-menx-bg border border-menx-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-menx-primary font-mono uppercase"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] text-xs font-extrabold rounded-lg transition-colors"
                  >
                    Apply
                  </button>
                </form>
              )}
            </div>

            {/* Order Summary & Totals */}
            <div className="menx-card rounded-2xl p-6 space-y-6 shadow-md">
              <h3 className="text-base font-bold text-white tracking-tight border-b border-menx-border pb-3">Order Summary</h3>
              
              {/* Cart Items List */}
              <div className="divide-y divide-gray-850 max-h-[300px] overflow-y-auto pr-1 space-y-3">
                {cart && cart.items && cart.items.map((item) => (
                  <div key={item.id} className="pt-3 first:pt-0 flex gap-3 text-xs">
                    {/* Thumbnail */}
                    <div className="w-14 h-14 bg-menx-bg border border-menx-border rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt={item.productTitle} className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag className="w-5 h-5 text-menx-text-muted" />
                      )}
                    </div>
                    {/* Metadata */}
                    <div className="flex-grow min-w-0 space-y-1">
                      <h4 className="font-bold text-white truncate">{item.productTitle}</h4>
                      <div className="text-[10px] text-menx-text-secondary flex flex-wrap gap-x-2">
                        {item.size && <span>Size: {item.size}</span>}
                        {item.color && <span>Color: {item.color}</span>}
                        <span>Qty: {item.quantity}</span>
                      </div>
                      <div className="flex justify-between text-[11px] pt-0.5">
                        <span className="text-menx-text-secondary">{formatCurrency(item.unitPrice)} each</span>
                        <span className="font-bold text-menx-primary font-mono">{formatCurrency(item.lineTotal)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <hr className="border-menx-border" />

              <h3 className="text-base font-bold text-white tracking-tight border-b border-menx-border pb-2">Checkout Totals</h3>

              {validating ? (
                <div className="py-8 flex flex-col items-center justify-center space-y-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-menx-primary"></div>
                  <span className="text-[10px] text-menx-text-muted">Validating checkout totals...</span>
                </div>
              ) : validationError ? (
                <div className="bg-menx-error/10 border border-menx-error/20 text-menx-error p-4 rounded-xl text-center space-y-2">
                  <AlertCircle className="w-6 h-6 mx-auto" />
                  <p className="text-xs font-bold">Shipping Delivery Blocked</p>
                  <p className="text-[11px] text-menx-text-secondary leading-relaxed">
                    {validationError}
                  </p>
                </div>
              ) : validationResult ? (
                <div className="space-y-4">
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between text-menx-text-secondary">
                      <span>Order Subtotal</span>
                      <span>{formatCurrency(validationResult.subtotal)}</span>
                    </div>
                    {validationResult.discount > 0 && (
                      <div className="flex justify-between text-menx-success">
                        <span>Coupon Savings</span>
                        <span>-{formatCurrency(validationResult.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-menx-text-secondary">
                      <span>Shipping Fee</span>
                      {validationResult.deliveryFee === 0 ? (
                        <span className="text-menx-success font-bold">FREE</span>
                      ) : (
                        <span>{formatCurrency(validationResult.deliveryFee)}</span>
                      )}
                    </div>
                    <div className="border-t border-menx-border pt-4 flex justify-between text-base font-black text-white">
                      <span>Total Payable</span>
                      <span className="text-menx-primary font-mono">{formatCurrency(validationResult.total)}</span>
                    </div>
                  </div>

                  <hr className="border-menx-border" />

                  {/* Order Error */}
                  {orderError && (
                    <div className="bg-menx-error/10 border border-menx-error/20 text-menx-error text-xs p-3 rounded-lg text-center font-bold">
                      {orderError}
                    </div>
                  )}

                  {/* Place Order CTA */}
                  <button
                    disabled={submitting}
                    onClick={handlePlaceOrder}
                    className="w-full py-3.5 bg-menx-primary hover:bg-menx-primary-hover disabled:bg-menx-surface-elevated disabled:text-menx-text-muted text-[#0B0F14] font-extrabold rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 text-sm shadow-lg shadow-menx-primary/5 uppercase tracking-wider"
                  >
                    {submitting ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-black" />
                    ) : (
                      <>
                        <span>Place COD Order</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-menx-text-muted">
                  Select a delivery address to calculate totals.
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Add New Address Modal */}
      <Modal
        isOpen={Boolean(showAddressModal)}
        onClose={() => setShowAddressModal(false)}
        maxWidth="max-w-2xl"
        title="Add Delivery Address"
        closeDisabled={addingAddress}
        formProps={{
          onSubmit: handleAddAddressSubmit,
        }}
        footer={(
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 w-full">
            <button
              type="button"
              disabled={addingAddress}
              onClick={() => setShowAddressModal(false)}
              className="w-full sm:w-auto py-2.5 px-5 border border-menx-border hover:bg-menx-surface-elevated rounded-lg text-xs font-bold text-menx-text-secondary hover:text-white transition-colors text-center disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addingAddress}
              className="w-full sm:w-auto py-2.5 px-5 bg-menx-primary hover:bg-menx-primary-hover disabled:bg-menx-surface-elevated text-[#0B0F14] text-xs font-extrabold rounded-lg transition-colors flex items-center justify-center space-x-1.5"
            >
              {addingAddress && <div className="animate-spin rounded-full h-3 w-3 border-t border-black mr-1" />}
              <span>Save Address</span>
            </button>
          </div>
        )}
      >
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            {/* Recipient Name */}
            <div className="space-y-1.5">
              <label className="text-xs text-menx-text-secondary font-bold uppercase">Recipient Name *</label>
              <input
                type="text"
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Full name of recipient"
                className="w-full max-w-full box-border min-w-0 bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white focus:outline-none focus:border-menx-primary font-medium"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <label className="text-xs text-menx-text-secondary font-bold uppercase">Phone Number *</label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full max-w-full box-border min-w-0 bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white focus:outline-none focus:border-menx-primary font-medium"
              />
            </div>

            {/* Address Line 1 */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs text-menx-text-secondary font-bold uppercase">Address Line 1 *</label>
              <input
                type="text"
                required
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Flat, House no., Building, Company, Apartment"
                className="w-full max-w-full box-border min-w-0 bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white focus:outline-none focus:border-menx-primary font-medium"
              />
            </div>

            {/* Address Line 2 */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs text-menx-text-secondary font-bold uppercase">Address Line 2</label>
              <input
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Area, Street, Sector, Village"
                className="w-full max-w-full box-border min-w-0 bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white focus:outline-none focus:border-menx-primary font-medium"
              />
            </div>

            {/* Landmark */}
            <div className="space-y-1.5">
              <label className="text-xs text-menx-text-secondary font-bold uppercase">Landmark</label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="E.g., Near Apollo Hospital"
                className="w-full max-w-full box-border min-w-0 bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white focus:outline-none focus:border-menx-primary font-medium"
              />
            </div>

            {/* Pin Code / Postal Code */}
            <div className="space-y-1.5">
              <label className="text-xs text-menx-text-secondary font-bold uppercase">Postal Code (Pincode) *</label>
              <input
                type="text"
                required
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="e.g. 534340 (Andhra Pradesh Pincode)"
                className="w-full max-w-full box-border min-w-0 bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white focus:outline-none focus:border-menx-primary font-mono font-bold"
              />
              <p className="text-[10px] text-menx-text-muted">Enter valid 6-digit Andhra Pradesh Pincode</p>
            </div>

            {/* City */}
            <div className="space-y-1.5">
              <label className="text-xs text-menx-text-secondary font-bold uppercase">City *</label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="E.g., Talapudi"
                className="w-full max-w-full box-border min-w-0 bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white focus:outline-none focus:border-menx-primary font-medium"
              />
            </div>

            {/* State */}
            <div className="space-y-1.5">
              <label className="text-xs text-menx-text-secondary font-bold uppercase">State *</label>
              <input
                type="text"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="E.g., Andhra Pradesh"
                className="w-full max-w-full box-border min-w-0 bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white focus:outline-none focus:border-menx-primary font-medium"
              />
            </div>

            {/* Alternate Phone */}
            <div className="space-y-1.5">
              <label className="text-xs text-menx-text-secondary font-bold uppercase">Alternate Phone</label>
              <input
                type="tel"
                value={alternatePhone}
                onChange={(e) => setAlternatePhone(e.target.value)}
                placeholder="Secondary contact number"
                className="w-full max-w-full box-border min-w-0 bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white focus:outline-none focus:border-menx-primary font-medium"
              />
            </div>

            {/* Address Type */}
            <div className="space-y-1.5">
              <label className="text-xs text-menx-text-secondary font-bold uppercase">Address Type</label>
              <select
                value={addressType}
                onChange={(e) => setAddressType(e.target.value)}
                className="w-full max-w-full box-border min-w-0 bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white focus:outline-none focus:border-menx-primary font-medium"
              >
                <option value="HOME">Home (All-day delivery)</option>
                <option value="WORK">Work (Delivery 9 AM - 5 PM)</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* Set Default */}
          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="defaultAddress"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded text-menx-primary focus:ring-menx-primary bg-menx-bg border-menx-border"
            />
            <label htmlFor="defaultAddress" className="text-xs text-menx-text-secondary font-bold select-none cursor-pointer">
              Make this my default delivery address
            </label>
          </div>
        </div>
      </Modal>

    </BaseLayout>
  );
}
