import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../utils/api.js';
import { Link } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';
import Modal from '../components/Modal.jsx';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { getCachedOrders, getMemoryCachedOrders } from '../utils/metadataCache.js';
import { 
  User, Mail, Phone, MapPin, Package, Shield, 
  Plus, Edit2, Trash2, Check, AlertCircle, Loader2, ArrowRight,
  ChevronRight, Lock, ShoppingBag, Eye, ExternalLink
} from 'lucide-react';

function getOrderStatusBadge(status) {
  switch (status) {
    case 'PENDING':
      return 'bg-menx-warning/10 border-menx-warning/30 text-menx-warning';
    case 'CONFIRMED':
      return 'bg-menx-info/10 border-menx-info/30 text-menx-info';
    case 'PACKED':
      return 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400';
    case 'SHIPPED':
      return 'bg-purple-500/10 border-purple-500/30 text-purple-400';
    case 'OUT_FOR_DELIVERY':
      return 'bg-menx-primary/10 border-menx-primary/30 text-menx-primary';
    case 'DELIVERED':
      return 'bg-menx-success/10 border-menx-success/30 text-menx-success';
    case 'CANCELLED':
      return 'bg-menx-error/10 border-menx-error/30 text-menx-error';
    case 'RETURN_REQUESTED':
      return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
    case 'RETURNED':
      return 'bg-teal-500/10 border-teal-500/30 text-teal-400';
    default:
      return 'bg-gray-500/10 border-menx-border text-menx-text-secondary';
  }
}

export default function Profile() {
  const { user, refreshUser, isAdminOrStaff } = useAuth();

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    phone: user?.phone || ''
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password Change State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Recent Orders State
  const cachedOrders = getMemoryCachedOrders();
  const [recentOrders, setRecentOrders] = useState(cachedOrders ? cachedOrders.slice(0, 3) : []);
  const [ordersLoading, setOrdersLoading] = useState(!cachedOrders);

  // Addresses State
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressesError, setAddressesError] = useState('');
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  
  // Address Form State
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

  // Sync profile form when user context updates
  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  // Load addresses on mount
  useEffect(() => {
    loadAddresses();
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

  // Load recent orders on mount
  useEffect(() => {
    let isMounted = true;
    async function loadRecentOrders() {
      try {
        const list = await getCachedOrders();
        if (isMounted && Array.isArray(list)) {
          setRecentOrders(list.slice(0, 3));
        }
      } catch (err) {
        console.error('Failed to load recent orders for profile:', err.message);
      } finally {
        if (isMounted) {
          setOrdersLoading(false);
        }
      }
    }
    loadRecentOrders();
    return () => { isMounted = false; };
  }, []);

  // Handle personal information submit
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
      setIsEditingProfile(false);
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      setProfileError(err.message || 'Failed to update personal details.');
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle password change submit
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
      setIsChangingPassword(false);
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Open address modal for Add/Edit
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
        isDefault: addresses.length === 0
      });
    }
    setAddressModalOpen(true);
  };

  // Handle address save
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

  const userInitial = user?.first_name ? user.first_name[0].toUpperCase() : (user?.email ? user.email[0].toUpperCase() : 'U');
  const userFullName = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Valued Customer';

  return (
    <BaseLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex-grow space-y-6 sm:space-y-8">
        
        {/* 1. PAGE HEADER */}
        <div className="border-b border-menx-border/80 pb-4 sm:pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">My Account</h1>
            <p className="text-xs sm:text-sm text-menx-text-secondary mt-0.5">
              Manage your profile, addresses, orders and more.
            </p>
          </div>
          {isAdminOrStaff && (
            <Link
              to="/admin"
              className="inline-flex items-center space-x-1.5 py-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 text-xs font-bold rounded-lg transition-colors self-start sm:self-auto"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Portal</span>
            </Link>
          )}
        </div>

        {/* 2. PROFILE SUMMARY CARD */}
        <div className="menx-card rounded-2xl p-4 sm:p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center space-x-4 min-w-0">
            {/* Avatar */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-2 border-menx-primary/40 flex items-center justify-center text-menx-primary text-xl sm:text-2xl font-black shadow-md shrink-0">
              {userInitial}
            </div>

            {/* Profile Info */}
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight truncate">
                  {userFullName}
                </h2>
                <span className="text-[10px] font-extrabold bg-menx-surface-elevated text-menx-primary border border-menx-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                  {isAdminOrStaff ? (user?.role?.replace(/_/g, ' ') || 'Staff') : 'Customer'}
                </span>
              </div>
              <div className="flex items-center space-x-1.5 text-xs text-menx-text-secondary font-mono truncate">
                <Mail className="w-3.5 h-3.5 text-menx-text-muted shrink-0" />
                <span className="truncate">{user?.email}</span>
              </div>
            </div>
          </div>

          {/* Action */}
          <button 
            type="button"
            onClick={() => {
              setIsEditingProfile(!isEditingProfile);
              setIsChangingPassword(false);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 py-2 px-4 bg-menx-surface-elevated hover:bg-menx-surface-elevated/80 border border-menx-border hover:border-menx-primary/40 text-white hover:text-menx-primary text-xs font-bold rounded-xl transition-all duration-200 shadow-sm shrink-0"
          >
            <Edit2 className="w-3.5 h-3.5 text-menx-primary" />
            <span>{isEditingProfile ? 'Close Edit' : 'Edit Profile'}</span>
          </button>
        </div>

        {/* Global Feedback Notifications */}
        {profileSuccess && (
          <div className="bg-menx-success/10 border border-menx-success/30 text-menx-success px-4 py-3 rounded-xl flex items-center space-x-2.5 text-xs font-medium">
            <Check className="w-4 h-4 shrink-0 text-menx-success" />
            <span>{profileSuccess}</span>
          </div>
        )}
        {profileError && (
          <div className="bg-menx-error/10 border border-menx-error/30 text-menx-error px-4 py-3 rounded-xl flex items-center space-x-2.5 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-menx-error" />
            <span>{profileError}</span>
          </div>
        )}
        {passwordSuccess && (
          <div className="bg-menx-success/10 border border-menx-success/30 text-menx-success px-4 py-3 rounded-xl flex items-center space-x-2.5 text-xs font-medium">
            <Check className="w-4 h-4 shrink-0 text-menx-success" />
            <span>{passwordSuccess}</span>
          </div>
        )}
        {passwordError && (
          <div className="bg-menx-error/10 border border-menx-error/30 text-menx-error px-4 py-3 rounded-xl flex items-center space-x-2.5 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-menx-error" />
            <span>{passwordError}</span>
          </div>
        )}

        {/* 3. PERSONAL INFORMATION */}
        <div className="menx-card rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-menx-border/80 pb-3">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-menx-text-muted flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-menx-primary" />
                <span>Personal Information</span>
              </h3>
              <p className="text-xs text-menx-text-secondary mt-0.5">
                Update your basic name and phone details.
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="inline-flex items-center space-x-1 text-xs font-bold text-menx-primary hover:text-menx-primary-hover hover:underline"
            >
              <Edit2 className="w-3 h-3" />
              <span>{isEditingProfile ? 'Cancel' : 'Edit'}</span>
            </button>
          </div>

          {isEditingProfile ? (
            /* Editable Form */
            <form onSubmit={handleProfileSubmit} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-menx-text-secondary uppercase tracking-wider">
                    First Name *
                  </label>
                  <input 
                    type="text" 
                    value={profileForm.firstName}
                    onChange={e => setProfileForm({ ...profileForm, firstName: e.target.value })}
                    required
                    className="bg-menx-surface-elevated border border-menx-border focus:border-menx-primary focus:ring-1 focus:ring-menx-primary text-white rounded-xl px-3.5 py-2 w-full outline-none transition-all text-xs sm:text-sm font-medium"
                    placeholder="First Name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-menx-text-secondary uppercase tracking-wider">
                    Last Name
                  </label>
                  <input 
                    type="text" 
                    value={profileForm.lastName}
                    onChange={e => setProfileForm({ ...profileForm, lastName: e.target.value })}
                    className="bg-menx-surface-elevated border border-menx-border focus:border-menx-primary focus:ring-1 focus:ring-menx-primary text-white rounded-xl px-3.5 py-2 w-full outline-none transition-all text-xs sm:text-sm font-medium"
                    placeholder="Last Name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-menx-text-secondary uppercase tracking-wider">
                    Phone Number
                  </label>
                  <input 
                    type="tel" 
                    value={profileForm.phone}
                    onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="bg-menx-surface-elevated border border-menx-border focus:border-menx-primary focus:ring-1 focus:ring-menx-primary text-white rounded-xl px-3.5 py-2 w-full outline-none transition-all text-xs sm:text-sm font-medium font-mono"
                    placeholder="10-digit number"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-menx-text-secondary uppercase tracking-wider">
                    Email Address
                  </label>
                  <input 
                    type="email" 
                    value={user?.email || ''} 
                    disabled
                    className="bg-menx-surface-elevated/40 border border-menx-border/60 text-menx-text-muted rounded-xl px-3.5 py-2 w-full cursor-not-allowed text-xs sm:text-sm font-mono"
                    title="Email modification is restricted."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="py-2 px-4 border border-menx-border hover:bg-menx-surface-elevated text-menx-text-secondary hover:text-white text-xs font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="inline-flex items-center space-x-1.5 py-2 px-5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] font-extrabold text-xs rounded-xl transition-all shadow-md disabled:opacity-50"
                >
                  {profileLoading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          ) : (
            /* Compact 3-Column Summary */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="bg-menx-surface-elevated/50 border border-menx-border/60 rounded-xl p-3 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-menx-text-muted block">
                  First Name
                </span>
                <p className="text-sm font-bold text-white truncate">
                  {user?.first_name || '—'}
                </p>
              </div>

              <div className="bg-menx-surface-elevated/50 border border-menx-border/60 rounded-xl p-3 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-menx-text-muted block">
                  Last Name
                </span>
                <p className="text-sm font-bold text-white truncate">
                  {user?.last_name || '—'}
                </p>
              </div>

              <div className="bg-menx-surface-elevated/50 border border-menx-border/60 rounded-xl p-3 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-menx-text-muted block">
                  Phone Number
                </span>
                <p className="text-sm font-bold text-white font-mono truncate">
                  {user?.phone || '—'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 4. ACCOUNT SECURITY */}
        <div className="menx-card rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-menx-surface-elevated border border-menx-border flex items-center justify-center text-menx-primary shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Account Security</h3>
                <p className="text-xs text-menx-text-secondary mt-0.5">
                  Keep your account safe by updating your password.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsChangingPassword(!isChangingPassword);
                setIsEditingProfile(false);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 py-2 px-4 bg-menx-surface-elevated hover:bg-menx-surface-elevated/80 border border-menx-border hover:border-menx-primary/40 text-white hover:text-menx-primary text-xs font-bold rounded-xl transition-all shadow-sm shrink-0"
            >
              <Lock className="w-3.5 h-3.5 text-menx-primary" />
              <span>{isChangingPassword ? 'Cancel' : 'Change Password'}</span>
            </button>
          </div>

          {isChangingPassword && (
            <form onSubmit={handlePasswordSubmit} className="border-t border-menx-border/80 pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-menx-text-secondary uppercase tracking-wider">
                    New Password *
                  </label>
                  <input 
                    type="password" 
                    value={passwordForm.newPassword}
                    onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    required
                    className="bg-menx-surface-elevated border border-menx-border focus:border-menx-primary focus:ring-1 focus:ring-menx-primary text-white rounded-xl px-3.5 py-2 w-full outline-none transition-all text-xs sm:text-sm font-medium"
                    placeholder="Min 8 characters"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-menx-text-secondary uppercase tracking-wider">
                    Confirm New Password *
                  </label>
                  <input 
                    type="password" 
                    value={passwordForm.confirmPassword}
                    onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    required
                    className="bg-menx-surface-elevated border border-menx-border focus:border-menx-primary focus:ring-1 focus:ring-menx-primary text-white rounded-xl px-3.5 py-2 w-full outline-none transition-all text-xs sm:text-sm font-medium"
                    placeholder="Repeat password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(false)}
                  className="py-2 px-4 border border-menx-border hover:bg-menx-surface-elevated text-menx-text-secondary hover:text-white text-xs font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="inline-flex items-center space-x-1.5 py-2 px-5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] font-extrabold text-xs rounded-xl transition-all shadow-md disabled:opacity-50"
                >
                  {passwordLoading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 5. RECENT ORDERS */}
        <div className="menx-card rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-menx-border/80 pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-menx-primary/10 border border-menx-primary/20 flex items-center justify-center text-menx-primary shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Recent Purchases</h3>
                <p className="text-xs text-menx-text-secondary mt-0.5">
                  View your latest orders and track their delivery status.
                </p>
              </div>
            </div>

            <Link
              to="/orders"
              className="inline-flex items-center space-x-1 text-xs font-bold text-menx-primary hover:text-menx-primary-hover group shrink-0"
            >
              <span>View All Orders</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {ordersLoading && recentOrders.length === 0 ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-menx-primary" />
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-menx-surface-elevated border border-menx-border flex items-center justify-center mx-auto text-menx-text-muted">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">No orders yet</p>
                <p className="text-xs text-menx-text-muted">Start exploring our collection to place your first order.</p>
              </div>
              <Link
                to="/"
                className="inline-flex items-center space-x-1.5 py-2 px-4 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] font-extrabold text-xs rounded-xl transition-all shadow-md"
              >
                <span>Start Shopping</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-menx-border/60">
              {recentOrders.map((order) => {
                const primaryItem = order.items && order.items[0];
                const itemCount = order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || order.items?.length || 1;
                const imageUrl = primaryItem?.product_image_snapshot || null;

                return (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3 group hover:bg-menx-surface-elevated/40 -mx-2 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      {/* Product Thumbnail */}
                      <div className="w-12 h-14 sm:w-14 sm:h-16 bg-menx-surface-elevated border border-menx-border rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={primaryItem?.product_title_snapshot || 'Ordered Item'}
                            className="w-full h-full object-cover select-none"
                            loading="lazy"
                          />
                        ) : (
                          <ShoppingBag className="w-5 h-5 text-menx-text-muted/60" />
                        )}
                      </div>

                      {/* Order Details */}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs sm:text-sm font-extrabold text-white group-hover:text-menx-primary transition-colors truncate">
                            {order.order_number}
                          </span>
                        </div>
                        <div className="text-[11px] text-menx-text-muted flex items-center space-x-1.5">
                          <span>{formatDate(order.created_at)}</span>
                          <span>•</span>
                          <span className="text-menx-text-secondary font-medium">
                            {itemCount} {itemCount === 1 ? 'item' : 'items'}
                          </span>
                          <span>•</span>
                          <span className="text-menx-primary font-bold font-mono">
                            {formatCurrency(order.total_payable)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge & Arrow */}
                    <div className="flex items-center space-x-2.5 shrink-0">
                      <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded border capitalize ${getOrderStatusBadge(order.order_status)}`}>
                        {order.order_status?.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      <ChevronRight className="w-4 h-4 text-menx-text-muted group-hover:text-menx-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* 6. SAVED ADDRESSES */}
        <div className="menx-card rounded-2xl p-5 sm:p-6 shadow-md space-y-5">
          <div className="flex items-center justify-between border-b border-menx-border/80 pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-menx-surface-elevated border border-menx-border flex items-center justify-center text-menx-primary shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Saved Addresses</h3>
                <p className="text-xs text-menx-text-secondary mt-0.5">
                  Manage your delivery destination book.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openAddressModal()}
              className="inline-flex items-center space-x-1.5 py-1.5 px-3.5 bg-menx-primary/10 hover:bg-menx-primary/20 text-menx-primary border border-menx-primary/30 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Address</span>
            </button>
          </div>

          {addressesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-7 h-7 animate-spin text-menx-primary" />
            </div>
          ) : addressesError ? (
            <div className="text-center text-xs text-menx-error py-4 bg-red-500/5 border border-menx-error/10 rounded-xl">
              {addressesError}
            </div>
          ) : addresses.length === 0 ? (
            <div className="text-center text-menx-text-muted py-8 text-sm space-y-3">
              <p>No saved addresses found.</p>
              <button 
                type="button"
                onClick={() => openAddressModal()}
                className="inline-flex items-center space-x-1.5 py-2 px-4 border border-menx-primary/30 hover:bg-menx-primary/10 text-menx-primary text-xs font-bold rounded-xl transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Address</span>
              </button>
            </div>
          ) : (
            /* 2-Column Responsive Address Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <div 
                  key={addr.id} 
                  className={`border rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all relative ${
                    addr.isDefault 
                      ? 'menx-card-elevated border-menx-primary/50 ring-1 ring-menx-primary/30 shadow-md' 
                      : 'menx-card hover:border-menx-primary/30'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold bg-menx-surface text-menx-text-secondary px-2 py-0.5 rounded border border-menx-border uppercase font-mono">
                        {addr.addressType || 'HOME'}
                      </span>
                      {addr.isDefault && (
                        <span className="text-[10px] font-black bg-menx-primary text-[#0B0F14] px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                          Default Address
                        </span>
                      )}
                    </div>

                    {/* Recipient */}
                    <h4 className="font-extrabold text-white text-sm sm:text-base leading-snug">
                      {addr.recipientName}
                    </h4>

                    {/* Address Block */}
                    <div className="text-xs text-menx-text-secondary leading-relaxed">
                      <p>{addr.addressLine1}</p>
                      {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                      {addr.landmark && <p className="text-menx-text-muted italic">Near: {addr.landmark}</p>}
                      <p className="font-medium text-white/90 pt-0.5">
                        {addr.city}, {addr.state} - {addr.postalCode}
                      </p>
                    </div>

                    {/* Phone */}
                    <div className="text-xs text-menx-text-muted flex items-center space-x-1.5 font-mono pt-1">
                      <Phone className="w-3.5 h-3.5 text-menx-text-muted" />
                      <span>{addr.phoneNumber}</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between border-t border-menx-border/60 pt-3 mt-4">
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => openAddressModal(addr)}
                        className="inline-flex items-center space-x-1 py-1 px-2.5 bg-menx-surface hover:bg-menx-surface-elevated border border-menx-border rounded-lg text-xs font-bold text-menx-text-secondary hover:text-white transition-colors"
                        title="Edit Address"
                      >
                        <Edit2 className="w-3 h-3 text-menx-primary" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="inline-flex items-center space-x-1 py-1 px-2.5 bg-menx-surface hover:bg-red-500/10 border border-menx-border hover:border-red-500/30 rounded-lg text-xs font-bold text-menx-text-secondary hover:text-menx-error transition-colors"
                        title="Delete Address"
                      >
                        <Trash2 className="w-3 h-3 text-menx-error" />
                        <span>Delete</span>
                      </button>
                    </div>
                    
                    {!addr.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultAddress(addr.id)}
                        className="text-[11px] text-menx-primary hover:text-menx-primary-hover font-extrabold uppercase tracking-wider hover:underline transition-colors"
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

      {/* Address Form Modal */}
      <Modal
        isOpen={Boolean(addressModalOpen)}
        onClose={() => setAddressModalOpen(false)}
        maxWidth="max-w-lg"
        title={editingAddress ? 'Edit Address' : 'Add New Address'}
        closeDisabled={addressSubmitting}
        formProps={{
          onSubmit: handleAddressSubmit,
        }}
        footer={(
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 w-full">
            <button
              type="button"
              disabled={addressSubmitting}
              onClick={() => setAddressModalOpen(false)}
              className="w-full sm:w-auto py-2.5 px-4 border border-menx-border hover:bg-menx-surface-elevated text-menx-text-secondary hover:text-white text-xs font-bold rounded-xl transition-colors text-center disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addressSubmitting}
              className="w-full sm:w-auto py-2.5 px-5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] text-xs font-extrabold rounded-xl transition-colors flex items-center justify-center space-x-1 disabled:opacity-50 shadow-md"
            >
              {addressSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              <span>Save Address</span>
            </button>
          </div>
        )}
      >
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-menx-text-secondary uppercase tracking-wider">Recipient Name *</label>
              <input 
                type="text" 
                value={addressForm.recipientName}
                onChange={e => setAddressForm({ ...addressForm, recipientName: e.target.value })}
                required
                className="w-full max-w-full box-border min-w-0 bg-menx-surface-elevated border border-menx-border focus:border-menx-primary text-white rounded-xl px-3 py-2 outline-none text-xs sm:text-sm font-medium"
                placeholder="Full Name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-menx-text-secondary uppercase tracking-wider">Phone Number *</label>
              <input 
                type="tel" 
                value={addressForm.phoneNumber}
                onChange={e => setAddressForm({ ...addressForm, phoneNumber: e.target.value })}
                required
                className="w-full max-w-full box-border min-w-0 bg-menx-surface-elevated border border-menx-border focus:border-menx-primary text-white rounded-xl px-3 py-2 outline-none text-xs sm:text-sm font-mono font-medium"
                placeholder="10-digit number"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-menx-text-secondary uppercase tracking-wider">Alternate Phone (Optional)</label>
              <input 
                type="tel" 
                value={addressForm.alternatePhone}
                onChange={e => setAddressForm({ ...addressForm, alternatePhone: e.target.value })}
                className="w-full max-w-full box-border min-w-0 bg-menx-surface-elevated border border-menx-border focus:border-menx-primary text-white rounded-xl px-3 py-2 outline-none text-xs sm:text-sm font-mono font-medium"
                placeholder="Optional contact"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-menx-text-secondary uppercase tracking-wider">Address Type</label>
              <select
                value={addressForm.addressType}
                onChange={e => setAddressForm({ ...addressForm, addressType: e.target.value })}
                className="w-full max-w-full box-border min-w-0 bg-menx-surface-elevated border border-menx-border focus:border-menx-primary text-white rounded-xl px-3 py-2 outline-none text-xs sm:text-sm font-bold"
              >
                <option value="HOME">HOME</option>
                <option value="WORK">WORK</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-menx-text-secondary uppercase tracking-wider">Address Line 1 *</label>
            <input 
              type="text" 
              value={addressForm.addressLine1}
              onChange={e => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
              required
              className="w-full max-w-full box-border min-w-0 bg-menx-surface-elevated border border-menx-border focus:border-menx-primary text-white rounded-xl px-3 py-2 outline-none text-xs sm:text-sm font-medium"
              placeholder="House/Flat No., Building Name, Street"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-menx-text-secondary uppercase tracking-wider">Address Line 2 (Optional)</label>
            <input 
              type="text" 
              value={addressForm.addressLine2}
              onChange={e => setAddressForm({ ...addressForm, addressLine2: e.target.value })}
              className="w-full max-w-full box-border min-w-0 bg-menx-surface-elevated border border-menx-border focus:border-menx-primary text-white rounded-xl px-3 py-2 outline-none text-xs sm:text-sm font-medium"
              placeholder="Locality, Area, Sector"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-menx-text-secondary uppercase tracking-wider">Landmark (Optional)</label>
              <input 
                type="text" 
                value={addressForm.landmark}
                onChange={e => setAddressForm({ ...addressForm, landmark: e.target.value })}
                className="w-full max-w-full box-border min-w-0 bg-menx-surface-elevated border border-menx-border focus:border-menx-primary text-white rounded-xl px-3 py-2 outline-none text-xs sm:text-sm font-medium"
                placeholder="E.g. Near City Mall"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-menx-text-secondary uppercase tracking-wider">City *</label>
              <input 
                type="text" 
                value={addressForm.city}
                onChange={e => setAddressForm({ ...addressForm, city: e.target.value })}
                required
                className="w-full max-w-full box-border min-w-0 bg-menx-surface-elevated border border-menx-border focus:border-menx-primary text-white rounded-xl px-3 py-2 outline-none text-xs sm:text-sm font-medium"
                placeholder="City Name"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-menx-text-secondary uppercase tracking-wider">State *</label>
              <input 
                type="text" 
                value={addressForm.state}
                onChange={e => setAddressForm({ ...addressForm, state: e.target.value })}
                required
                className="w-full max-w-full box-border min-w-0 bg-menx-surface-elevated border border-menx-border focus:border-menx-primary text-white rounded-xl px-3 py-2 outline-none text-xs sm:text-sm font-medium"
                placeholder="E.g. Andhra Pradesh"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-menx-text-secondary uppercase tracking-wider">Postal Code *</label>
              <input 
                type="text" 
                value={addressForm.postalCode}
                onChange={e => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                required
                className="w-full max-w-full box-border min-w-0 bg-menx-surface-elevated border border-menx-border focus:border-menx-primary text-white rounded-xl px-3 py-2 outline-none text-xs sm:text-sm font-mono font-medium"
                placeholder="6-digit PIN code"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input 
              type="checkbox" 
              id="isDefault" 
              checked={addressForm.isDefault}
              onChange={e => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
              disabled={editingAddress?.isDefault}
              className="rounded border-menx-border text-menx-primary bg-menx-bg focus:ring-menx-primary/20 h-4 w-4"
            />
            <label htmlFor="isDefault" className="text-xs text-menx-text-secondary select-none cursor-pointer">
              Mark this address as default
            </label>
          </div>

          {addressSubmitError && (
            <div className="bg-menx-error/10 border border-menx-error/20 text-menx-error px-3 py-2 rounded-xl flex items-center space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{addressSubmitError}</span>
            </div>
          )}
        </div>
      </Modal>
    </BaseLayout>
  );
}
