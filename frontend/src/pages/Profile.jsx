import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../utils/api.js';
import { Link } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';
import { formatCurrency } from '../utils/formatters.js';
import { 
  User, Mail, Phone, MapPin, Package, Shield, 
  Plus, Edit2, Trash2, Check, AlertCircle, Loader2, ArrowRight
} from 'lucide-react';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  
  // Ref for scrolling to Personal Information
  const personalInfoRef = useRef(null);

  // Profile fields state
  const [profileForm, setProfileForm] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    phone: user?.phone || ''
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password fields state
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Addresses state
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressesError, setAddressesError] = useState('');
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  
  // Address form fields state
  const [addressForm, setAddressForm] = useState({
    recipientName: '',
    phoneNumber: '',
    alternatePhone: '',
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    city: '',
    state: '',
    postalCode: '',
    addressType: 'HOME',
    isDefault: false
  });
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const [addressSubmitError, setAddressSubmitError] = useState('');

  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');

  // Load user profile details on mount
  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  // Load addresses and recent orders on mount
  useEffect(() => {
    loadAddresses();
    loadRecentOrders();
  }, []);

  async function loadAddresses() {
    setAddressesLoading(true);
    setAddressesError('');
    try {
      const res = await api.get('/addresses');
      setAddresses(res.data || []);
    } catch (err) {
      setAddressesError(err.message || 'Failed to load addresses.');
    } finally {
      setAddressesLoading(false);
    }
  }

  async function loadRecentOrders() {
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const res = await api.get('/orders?limit=5');
      setOrders(res.data?.orders || []);
    } catch (err) {
      setOrdersError(err.message || 'Failed to load orders.');
    } finally {
      setOrdersLoading(false);
    }
  }

  // Handle personal information updates
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileSuccess('');
    setProfileError('');
    try {
      await api.put('/auth/profile', {
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        phone: profileForm.phone
      });
      await refreshUser();
      setProfileSuccess('Personal details updated successfully.');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      setProfileError(err.message || 'Failed to update personal details.');
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle password change updates
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordSuccess('');
    setPasswordError('');

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      setPasswordLoading(false);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match.');
      setPasswordLoading(false);
      return;
    }

    try {
      await api.post('/auth/password-update', {
        newPassword: passwordForm.newPassword
      });
      setPasswordSuccess('Password changed successfully.');
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle open address modal for Add/Edit
  const openAddressModal = (address = null) => {
    setAddressSubmitError('');
    if (address) {
      setEditingAddress(address);
      setAddressForm({
        recipientName: address.recipientName || '',
        phoneNumber: address.phoneNumber || '',
        alternatePhone: address.alternatePhone || '',
        addressLine1: address.addressLine1 || '',
        addressLine2: address.addressLine2 || '',
        landmark: address.landmark || '',
        city: address.city || '',
        state: address.state || '',
        postalCode: address.postalCode || '',
        addressType: address.addressType || 'HOME',
        isDefault: address.isDefault || false
      });
    } else {
      setEditingAddress(null);
      setAddressForm({
        recipientName: '',
        phoneNumber: '',
        alternatePhone: '',
        addressLine1: '',
        addressLine2: '',
        landmark: '',
        city: '',
        state: '',
        postalCode: '',
        addressType: 'HOME',
        isDefault: addresses.length === 0 // Default true if it is the first address
      });
    }
    setAddressModalOpen(true);
  };

  // Handle address submit
  const handleAddressSubmit = async (e) => {
    e.preventDefault();
    setAddressSubmitting(true);
    setAddressSubmitError('');
    try {
      const payload = {
        ...addressForm,
        alternatePhone: addressForm.alternatePhone || null,
        addressLine2: addressForm.addressLine2 || null,
        landmark: addressForm.landmark || null
      };

      if (editingAddress) {
        await api.put(`/addresses/${editingAddress.id}`, payload);
      } else {
        await api.post('/addresses', payload);
      }

      setAddressModalOpen(false);
      await loadAddresses();
    } catch (err) {
      setAddressSubmitError(err.message || 'Failed to save address.');
    } finally {
      setAddressSubmitting(false);
    }
  };

  // Handle set address as default
  const handleSetDefaultAddress = async (addressId) => {
    try {
      await api.patch(`/addresses/${addressId}/default`);
      await loadAddresses();
    } catch (err) {
      alert(err.message || 'Failed to mark default address.');
    }
  };

  // Handle address deletion
  const handleDeleteAddress = async (addressId) => {
    if (!window.confirm('Are you sure you want to delete this address?')) return;
    try {
      await api.delete(`/addresses/${addressId}`);
      await loadAddresses();
    } catch (err) {
      alert(err.message || 'Failed to delete address.');
    }
  };

  // Scroll to profile details
  const scrollToPersonalInfo = () => {
    personalInfoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getOrderStatusColor = (status) => {
    switch (status) {
      case 'PENDING':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'CONFIRMED':
      case 'PACKED':
      case 'SHIPPED':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'OUT_FOR_DELIVERY':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'DELIVERED':
        return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'CANCELLED':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const userInitial = user?.first_name ? user.first_name[0].toUpperCase() : 'U';

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow space-y-10">
        
        {/* Profile Header Card */}
        <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="w-20 h-20 rounded-full bg-gray-800 border-2 border-amber-500 flex items-center justify-center text-amber-500 text-3xl font-black shadow-lg">
              {userInitial}
            </div>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-black text-white tracking-tight">
                {user?.first_name} {user?.last_name || ''}
              </h1>
              <div className="flex items-center justify-center sm:justify-start space-x-2 text-gray-400 text-sm">
                <Mail className="w-4 h-4 text-gray-500" />
                <span>{user?.email}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={scrollToPersonalInfo}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 py-2.5 px-5 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition-all duration-200 shadow-md"
          >
            <Edit2 className="w-4 h-4" />
            <span>Edit Profile</span>
          </button>
        </div>

        {/* Main Grid: Info, Password & Addresses */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Personal info & Account security */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Personal Information Form */}
            <div ref={personalInfoRef} className="bg-gray-900 border border-gray-850 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="border-b border-gray-850 pb-4">
                <h2 className="text-lg font-extrabold text-white flex items-center space-x-2">
                  <User className="w-5 h-5 text-amber-500" />
                  <span>Personal Information</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">Update your basic name and telephone details.</p>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">First Name</label>
                    <input 
                      type="text" 
                      value={profileForm.firstName}
                      onChange={e => setProfileForm({ ...profileForm, firstName: e.target.value })}
                      required
                      className="bg-gray-950 border border-gray-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white rounded-lg px-4 py-2.5 w-full outline-none transition-all text-sm"
                      placeholder="First Name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Last Name</label>
                    <input 
                      type="text" 
                      value={profileForm.lastName}
                      onChange={e => setProfileForm({ ...profileForm, lastName: e.target.value })}
                      className="bg-gray-950 border border-gray-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white rounded-lg px-4 py-2.5 w-full outline-none transition-all text-sm"
                      placeholder="Last Name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
                    <input 
                      type="email" 
                      value={user?.email || ''} 
                      disabled
                      className="bg-gray-950/40 border border-gray-850/80 text-gray-500 rounded-lg px-4 py-2.5 w-full cursor-not-allowed text-sm"
                      title="Email changes are restricted."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Phone Number</label>
                    <input 
                      type="tel" 
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="bg-gray-950 border border-gray-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white rounded-lg px-4 py-2.5 w-full outline-none transition-all text-sm"
                      placeholder="Phone number"
                    />
                  </div>
                </div>

                {profileSuccess && (
                  <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-2.5 rounded-lg flex items-center space-x-2 text-xs">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{profileSuccess}</span>
                  </div>
                )}
                {profileError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2.5 rounded-lg flex items-center space-x-2 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{profileError}</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 py-2 px-5 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition-colors text-sm disabled:opacity-50"
                  >
                    {profileLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Account Security (Password change) */}
            <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="border-b border-gray-850 pb-4">
                <h2 className="text-lg font-extrabold text-white flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-amber-500" />
                  <span>Account Security</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">Secure your account by updating your password details.</p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">New Password</label>
                    <input 
                      type="password" 
                      value={passwordForm.newPassword}
                      onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      required
                      className="bg-gray-950 border border-gray-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white rounded-lg px-4 py-2.5 w-full outline-none transition-all text-sm"
                      placeholder="Min 8 characters"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Confirm New Password</label>
                    <input 
                      type="password" 
                      value={passwordForm.confirmPassword}
                      onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      required
                      className="bg-gray-950 border border-gray-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white rounded-lg px-4 py-2.5 w-full outline-none transition-all text-sm"
                      placeholder="Repeat password"
                    />
                  </div>
                </div>

                {passwordSuccess && (
                  <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-2.5 rounded-lg flex items-center space-x-2 text-xs">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}
                {passwordError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2.5 rounded-lg flex items-center space-x-2 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 py-2 px-5 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition-colors text-sm disabled:opacity-50"
                  >
                    {passwordLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Update Password</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Recent Orders List Card */}
            <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="border-b border-gray-850 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-white flex items-center space-x-2">
                    <Package className="w-5 h-5 text-amber-500" />
                    <span>Recent Orders</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">Review tracking details of your latest purchases.</p>
                </div>
                <Link 
                  to="/orders"
                  className="text-xs text-amber-500 hover:text-amber-400 font-bold flex items-center space-x-1 uppercase tracking-wider transition-colors"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {ordersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              ) : ordersError ? (
                <div className="text-center text-xs text-red-400 py-4 bg-red-500/5 border border-red-500/10 rounded-xl">
                  {ordersError}
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center text-gray-500 py-8 text-sm">
                  You haven't placed any orders yet.
                </div>
              ) : (
                <div className="divide-y divide-gray-850">
                  {orders.map(order => (
                    <div key={order.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-sm">
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2.5">
                          <span className="font-mono font-bold text-gray-300">#{order.order_number}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getOrderStatusColor(order.order_status)}`}>
                            {order.order_status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Placed on {new Date(order.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                        <div className="text-right">
                          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Total</div>
                          <div className="text-base font-black text-amber-500">{formatCurrency(order.total_payable)}</div>
                        </div>
                        <Link 
                          to={`/orders/${order.id}`}
                          className="py-1.5 px-3 bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white rounded-lg transition-colors text-xs font-bold"
                        >
                          Details
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Address Book */}
          <div className="space-y-6">
            
            {/* Address Management Card */}
            <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="border-b border-gray-850 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-white flex items-center space-x-2">
                    <MapPin className="w-5 h-5 text-amber-500" />
                    <span>Saved Addresses</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">Manage your delivery destination book.</p>
                </div>
                <button
                  onClick={() => openAddressModal()}
                  className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 hover:border-amber-500/30 rounded-lg transition-all"
                  title="Add New Address"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {addressesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              ) : addressesError ? (
                <div className="text-center text-xs text-red-400 py-4 bg-red-500/5 border border-red-500/10 rounded-xl">
                  {addressesError}
                </div>
              ) : addresses.length === 0 ? (
                <div className="text-center text-gray-500 py-8 text-sm space-y-3">
                  <p>No saved addresses found.</p>
                  <button 
                    onClick={() => openAddressModal()}
                    className="inline-flex items-center space-x-1.5 py-2 px-4 border border-amber-500/30 hover:bg-amber-500/10 text-amber-500 text-xs font-bold rounded-lg transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Address</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {addresses.map(addr => (
                    <div 
                      key={addr.id} 
                      className={`border rounded-xl p-4 space-y-3 transition-all relative ${
                        addr.isDefault 
                          ? 'bg-amber-500/[0.02] border-amber-500/35 shadow-md' 
                          : 'bg-gray-950/40 border-gray-850 hover:border-gray-800'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-200 text-sm">{addr.recipientName}</span>
                            <span className="text-[9px] font-bold bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded border border-gray-700 uppercase">
                              {addr.addressType}
                            </span>
                            {addr.isDefault && (
                              <span className="text-[9px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/25 px-1.5 py-0.5 rounded uppercase">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 leading-relaxed">
                            {addr.addressLine1}
                            {addr.addressLine2 && `, ${addr.addressLine2}`}
                            {addr.landmark && ` (Near: ${addr.landmark})`}
                            <br />
                            {addr.city}, {addr.state} - {addr.postalCode}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center space-x-1">
                            <Phone className="w-3 h-3 text-gray-600" />
                            <span>{addr.phoneNumber}</span>
                          </div>
                        </div>
                      </div>

                      {/* Address Actions Bar */}
                      <div className="flex items-center justify-between border-t border-gray-850/60 pt-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openAddressModal(addr)}
                            className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors"
                            title="Edit Address"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="p-1.5 hover:bg-red-500/15 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                            title="Delete Address"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        {!addr.isDefault && (
                          <button
                            onClick={() => handleSetDefaultAddress(addr.id)}
                            className="text-[10px] text-amber-500 hover:text-amber-400 font-bold uppercase tracking-wider hover:underline transition-colors"
                          >
                            Set Default
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Address Form Modal (Slideout/Popup style) */}
      {addressModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div 
            className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all"
            role="dialog"
            aria-modal="true"
          >
            <div className="border-b border-gray-800 p-5 flex items-center justify-between">
              <h3 className="text-md font-bold text-white uppercase tracking-wider">
                {editingAddress ? 'Edit Address' : 'Add New Address'}
              </h3>
              <button 
                onClick={() => setAddressModalOpen(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddressSubmit} className="flex-grow overflow-y-auto p-5 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Recipient Name *</label>
                  <input 
                    type="text" 
                    value={addressForm.recipientName}
                    onChange={e => setAddressForm({ ...addressForm, recipientName: e.target.value })}
                    required
                    className="bg-gray-950 border border-gray-850 focus:border-amber-500 text-white rounded-lg px-3 py-2 w-full outline-none text-sm"
                    placeholder="E.g. Satish Mahadev"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Phone Number *</label>
                  <input 
                    type="tel" 
                    value={addressForm.phoneNumber}
                    onChange={e => setAddressForm({ ...addressForm, phoneNumber: e.target.value })}
                    required
                    className="bg-gray-950 border border-gray-850 focus:border-amber-500 text-white rounded-lg px-3 py-2 w-full outline-none text-sm"
                    placeholder="10-digit number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Alternate Phone (Opt)</label>
                  <input 
                    type="tel" 
                    value={addressForm.alternatePhone}
                    onChange={e => setAddressForm({ ...addressForm, alternatePhone: e.target.value })}
                    className="bg-gray-950 border border-gray-850 focus:border-amber-500 text-white rounded-lg px-3 py-2 w-full outline-none text-sm"
                    placeholder="Optional phone number"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Address Type</label>
                  <select
                    value={addressForm.addressType}
                    onChange={e => setAddressForm({ ...addressForm, addressType: e.target.value })}
                    className="bg-gray-950 border border-gray-850 focus:border-amber-500 text-white rounded-lg px-3 py-2 w-full outline-none text-sm"
                  >
                    <option value="HOME">HOME</option>
                    <option value="WORK">WORK</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Address Line 1 *</label>
                <input 
                  type="text" 
                  value={addressForm.addressLine1}
                  onChange={e => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                  required
                  className="bg-gray-950 border border-gray-850 focus:border-amber-500 text-white rounded-lg px-3 py-2 w-full outline-none text-sm"
                  placeholder="Street, flat/apartment no."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Address Line 2 (Optional)</label>
                <input 
                  type="text" 
                  value={addressForm.addressLine2}
                  onChange={e => setAddressForm({ ...addressForm, addressLine2: e.target.value })}
                  className="bg-gray-950 border border-gray-850 focus:border-amber-500 text-white rounded-lg px-3 py-2 w-full outline-none text-sm"
                  placeholder="Locality, sector, area details"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Landmark (Optional)</label>
                  <input 
                    type="text" 
                    value={addressForm.landmark}
                    onChange={e => setAddressForm({ ...addressForm, landmark: e.target.value })}
                    className="bg-gray-950 border border-gray-850 focus:border-amber-500 text-white rounded-lg px-3 py-2 w-full outline-none text-sm"
                    placeholder="E.g. Near mall"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">City *</label>
                  <input 
                    type="text" 
                    value={addressForm.city}
                    onChange={e => setAddressForm({ ...addressForm, city: e.target.value })}
                    required
                    className="bg-gray-950 border border-gray-850 focus:border-amber-500 text-white rounded-lg px-3 py-2 w-full outline-none text-sm"
                    placeholder="City Name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">State *</label>
                  <input 
                    type="text" 
                    value={addressForm.state}
                    onChange={e => setAddressForm({ ...addressForm, state: e.target.value })}
                    required
                    className="bg-gray-950 border border-gray-850 focus:border-amber-500 text-white rounded-lg px-3 py-2 w-full outline-none text-sm"
                    placeholder="E.g. Telangana"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Postal Code *</label>
                  <input 
                    type="text" 
                    value={addressForm.postalCode}
                    onChange={e => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                    required
                    className="bg-gray-950 border border-gray-850 focus:border-amber-500 text-white rounded-lg px-3 py-2 w-full outline-none text-sm"
                    placeholder="6-digit postal code"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input 
                  type="checkbox" 
                  id="isDefault" 
                  checked={addressForm.isDefault}
                  onChange={e => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                  disabled={editingAddress?.isDefault} // Cannot unset default directly if it's already default
                  className="rounded border-gray-800 text-amber-500 bg-gray-950 focus:ring-amber-500/20 h-4 w-4"
                />
                <label htmlFor="isDefault" className="text-xs text-gray-400 select-none cursor-pointer">
                  Mark this address as default
                </label>
              </div>

              {addressSubmitError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-2 rounded-lg flex items-center space-x-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{addressSubmitError}</span>
                </div>
              )}

              <div className="border-t border-gray-800 pt-4 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setAddressModalOpen(false)}
                  className="py-2 px-4 border border-gray-850 hover:bg-gray-850 text-gray-400 hover:text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addressSubmitting}
                  className="py-2 px-5 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-lg transition-colors flex items-center space-x-1 disabled:opacity-50"
                >
                  {addressSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Address</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </BaseLayout>
  );
}
