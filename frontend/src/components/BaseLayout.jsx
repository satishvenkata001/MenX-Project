import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import {
  Menu, X, User, ShoppingBag, Heart, LogOut, LayoutDashboard,
  Shield, Package, RotateCcw, ShoppingCart, HelpCircle,
  MessageSquare, ChevronRight, ArrowRight, Mail
} from 'lucide-react';

export default function BaseLayout({ children }) {
  const { user, logout, isAdminOrStaff, isAuthenticated } = useAuth();
  const { wishlist } = useWishlist();
  const { cart } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  useEffect(() => {
    setMounted(true);
  }, []);

  const cartCount = React.useMemo(() => {
    return cart?.summary?.totalQuantity ?? (cart?.items ? cart.items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0);
  }, [cart]);

  const wishlistCount = React.useMemo(() => {
    return wishlist?.length || 0;
  }, [wishlist]);

  const handleLogout = React.useCallback(() => {
    logout();
    navigate('/');
  }, [logout, navigate]);

  // Handle ESC key to close mobile drawer & body scroll lock
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  // Close mobile drawer on route change
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-menx-bg text-menx-text flex flex-col w-full max-w-full overflow-x-hidden">
      {/* Navigation Header */}
      <header className="fixed top-0 left-0 right-0 w-full z-[1000] bg-menx-surface/90 backdrop-blur-md border-b border-menx-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-1.5 group">
                <span className="text-xl sm:text-2xl font-black tracking-wider text-menx-text">
                  MEN<span className="text-menx-primary">X</span>
                </span>
              </Link>
            </div>

            {/* Navigation links - Desktop */}
            <nav className="hidden md:flex space-x-7 items-center text-sm font-medium text-menx-text-secondary">
              <Link to="/" className="hover:text-menx-primary transition-colors duration-200">Shop</Link>
              {isAuthenticated && (
                <>
                  <Link to="/orders" className="hover:text-menx-primary transition-colors duration-200">Orders</Link>
                  <Link to="/returns" className="hover:text-menx-primary transition-colors duration-200">Returns</Link>
                  <Link to="/support" className="hover:text-menx-primary transition-colors duration-200">Support</Link>
                </>
              )}
              <Link to="/help" className="hover:text-menx-primary transition-colors duration-200">Help</Link>
              <Link to="/cart" className="flex items-center space-x-1.5 hover:text-menx-primary transition-colors duration-200">
                <ShoppingBag className="w-4 h-4 text-menx-primary" />
                <span>Cart</span>
                {cartCount > 0 && (
                  <span className="bg-menx-primary text-[#0B0F14] text-[10px] font-extrabold rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Link>
              {isAuthenticated && (
                <Link to="/wishlist" className="flex items-center space-x-1.5 hover:text-menx-primary transition-colors duration-200">
                  <Heart className="w-4 h-4 text-menx-error fill-menx-error" />
                  <span>Wishlist</span>
                  {wishlistCount > 0 && (
                    <span className="bg-menx-error text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {wishlistCount}
                    </span>
                  )}
                </Link>
              )}
              {isAdminOrStaff && (
                <Link to="/admin" className="flex items-center space-x-1 hover:text-menx-primary transition-colors duration-200">
                  <LayoutDashboard className="w-4 h-4 text-amber-500" />
                  <span>Admin Dashboard</span>
                </Link>
              )}
            </nav>

            {/* Action buttons - Desktop */}
            <div className="hidden md:flex items-center space-x-6">
              {isAuthenticated ? (
                <div className="flex items-center space-x-4">
                  <Link to="/profile" className="flex items-center space-x-2 text-sm text-menx-text-secondary hover:text-menx-primary transition-colors duration-200">
                    <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-amber-500 font-semibold shadow-inner">
                      {user.first_name ? user.first_name[0].toUpperCase() : 'U'}
                    </div>
                    <span>{user.first_name || 'User'}</span>
                    {isAdminOrStaff && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono font-bold flex items-center">
                        <Shield className="w-2.5 h-2.5 mr-0.5" />
                        STAFF
                      </span>
                    )}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="p-2 hover:bg-menx-error/10 text-menx-text-secondary hover:text-menx-error rounded-full transition-colors duration-200"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center space-x-1.5 py-2 px-4 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] text-sm font-extrabold rounded-xl transition-all duration-200 shadow-md shadow-menx-primary/20"
                >
                  <User className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>
              )}
            </div>

            {/* Mobile Actions: Wishlist, Cart, Orders & Hamburger Menu */}
            <div className="flex md:hidden items-center space-x-1 sm:space-x-1.5">
              {/* Wishlist Link */}
              <Link
                to="/wishlist"
                aria-label="Wishlist"
                title="Wishlist"
                className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors duration-200 ${
                  path === '/wishlist'
                    ? 'text-menx-primary bg-menx-primary/10'
                    : 'text-menx-text-secondary hover:text-menx-text hover:bg-menx-surface-elevated'
                }`}
              >
                <Heart className={`w-5 h-5 ${path === '/wishlist' ? 'fill-amber-500 text-menx-primary' : ''}`} />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center border-2 border-menx-surface shadow-sm leading-none">
                    {wishlistCount > 99 ? '99+' : wishlistCount}
                  </span>
                )}
              </Link>

              {/* Cart Link */}
              <Link
                to="/cart"
                aria-label="Cart"
                title="Cart"
                className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors duration-200 ${
                  path === '/cart'
                    ? 'text-menx-primary bg-menx-primary/10'
                    : 'text-menx-text-secondary hover:text-menx-text hover:bg-menx-surface-elevated'
                }`}
              >
                <ShoppingBag className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-amber-500 text-black text-[10px] font-extrabold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center border-2 border-gray-900 shadow-sm leading-none">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>

              {/* Orders Link */}
              <Link
                to="/orders"
                aria-label="My Orders"
                title="My Orders"
                className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors duration-200 ${
                  path === '/orders' || path.startsWith('/orders/')
                    ? 'text-menx-primary bg-menx-primary/10'
                    : 'text-menx-text-secondary hover:text-menx-text hover:bg-menx-surface-elevated'
                }`}
              >
                <Package className="w-5 h-5" />
              </Link>

              {/* Mobile menu trigger button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-navigation-drawer"
                title={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                className={`w-10 h-10 flex items-center justify-center rounded-lg focus:outline-none transition-colors duration-200 ${
                  mobileMenuOpen
                    ? 'text-menx-primary bg-menx-primary/10'
                    : 'text-menx-text-secondary hover:text-menx-text hover:bg-menx-surface-elevated'
                }`}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* CUSTOMER MOBILE NAVIGATION DRAWER 2.0 (Top-Level Portal to document.body) */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <>
          {/* Semi-transparent Backdrop Overlay */}
          <div
            className={`fixed inset-0 z-[1100] bg-black/75 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
              mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden={!mobileMenuOpen}
          />

          {/* Slide-in Drawer Container */}
          <aside
            id="mobile-navigation-drawer"
            aria-label="Mobile Navigation"
            role="dialog"
            aria-modal="true"
            className={`fixed top-0 bottom-0 left-0 w-[85vw] max-w-[320px] sm:max-w-[340px] h-full h-[100dvh] z-[1200] bg-menx-surface border-r border-menx-border shadow-2xl flex flex-col justify-between transform transition-transform duration-300 ease-out md:hidden overflow-hidden ${
              mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
          {/* Top Fixed Header with Logo & Close Button */}
          <div className="p-4 border-b border-menx-border/80 flex items-center justify-between shrink-0 bg-menx-surface-elevated/40">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center space-x-1.5 group"
            >
              <span className="text-xl font-black tracking-wider text-menx-text">
                MEN<span className="text-menx-primary">X</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-menx-text-muted px-1.5 py-0.5 rounded bg-menx-surface border border-menx-border ml-1">
                Edition
              </span>
            </Link>
            
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-menx-surface-elevated border border-menx-border text-menx-text-secondary hover:text-white hover:border-menx-primary/40 transition-colors active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Navigation Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 text-sm font-medium overscroll-contain">
            
            {/* ACCOUNT IDENTITY CARD */}
            <div className="bg-menx-surface-elevated border border-menx-border/90 p-3.5 rounded-2xl shadow-sm">
              {isAuthenticated ? (
                <div className="flex items-center space-x-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-menx-primary/30 flex items-center justify-center text-menx-primary font-black text-base shadow-sm shrink-0">
                    {user?.first_name ? user.first_name[0].toUpperCase() : (user?.email ? user.email[0].toUpperCase() : 'U')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-extrabold text-white text-sm truncate leading-snug">
                        {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Account User'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-menx-text-muted font-medium truncate">
                        {isAdminOrStaff ? (user?.role?.replace(/_/g, ' ') || 'Staff Member') : 'Customer Account'}
                      </span>
                      {isAdminOrStaff && (
                        <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/25 px-1 py-0.2 rounded font-mono font-bold uppercase">
                          Staff
                        </span>
                      )}
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-[11px] text-menx-primary hover:text-menx-primary-hover font-bold inline-flex items-center space-x-0.5 mt-1.5 group"
                    >
                      <span>Manage Profile</span>
                      <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-menx-surface border border-menx-border flex items-center justify-center text-menx-text-muted shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-white text-sm">Welcome Guest</div>
                      <div className="text-[11px] text-menx-text-muted">Sign in for personalized orders & bag</div>
                    </div>
                  </div>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-2 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] font-extrabold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-menx-primary/10 active:scale-[0.98]"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Sign In to MENX</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>

            {/* SECTION 1: SHOPPING */}
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-menx-text-muted px-2.5 block mb-1">
                Shopping
              </span>

              {/* Shop */}
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`min-h-[44px] flex items-center justify-between py-2.5 px-3 rounded-xl transition-all duration-200 group ${
                  path === '/'
                    ? 'bg-menx-primary/10 border border-menx-primary/30 text-white font-bold'
                    : 'text-menx-text-secondary hover:bg-menx-surface-elevated/70 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    path === '/' ? 'bg-menx-primary/20 text-menx-primary' : 'bg-menx-surface-elevated text-menx-text-muted group-hover:text-menx-primary group-hover:bg-menx-primary/10'
                  }`}>
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <span className="text-xs sm:text-sm">Shop</span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${path === '/' ? 'text-menx-primary translate-x-0.5' : 'text-menx-border group-hover:text-menx-text-muted group-hover:translate-x-0.5'}`} />
              </Link>

              {/* Orders */}
              <Link
                to="/orders"
                onClick={() => setMobileMenuOpen(false)}
                className={`min-h-[44px] flex items-center justify-between py-2.5 px-3 rounded-xl transition-all duration-200 group ${
                  path === '/orders' || path.startsWith('/orders/')
                    ? 'bg-menx-primary/10 border border-menx-primary/30 text-white font-bold'
                    : 'text-menx-text-secondary hover:bg-menx-surface-elevated/70 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    path === '/orders' || path.startsWith('/orders/') ? 'bg-menx-primary/20 text-menx-primary' : 'bg-menx-surface-elevated text-menx-text-muted group-hover:text-menx-primary group-hover:bg-menx-primary/10'
                  }`}>
                    <Package className="w-4 h-4" />
                  </div>
                  <span className="text-xs sm:text-sm">Orders</span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${path === '/orders' || path.startsWith('/orders/') ? 'text-menx-primary translate-x-0.5' : 'text-menx-border group-hover:text-menx-text-muted group-hover:translate-x-0.5'}`} />
              </Link>
            </div>

            {/* SECTION 2: HELP & SUPPORT */}
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-menx-text-muted px-2.5 block mb-1">
                Help & Support
              </span>

              {/* Help Center & FAQs */}
              <Link
                to="/help"
                onClick={() => setMobileMenuOpen(false)}
                className={`min-h-[44px] flex items-center justify-between py-2.5 px-3 rounded-xl transition-all duration-200 group ${
                  path === '/help' || path.startsWith('/help/')
                    ? 'bg-menx-primary/10 border border-menx-primary/30 text-white font-bold'
                    : 'text-menx-text-secondary hover:bg-menx-surface-elevated/70 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    path === '/help' || path.startsWith('/help/') ? 'bg-menx-primary/20 text-menx-primary' : 'bg-menx-surface-elevated text-menx-text-muted group-hover:text-menx-primary group-hover:bg-menx-primary/10'
                  }`}>
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <span className="text-xs sm:text-sm">Help Center & FAQs</span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${path === '/help' || path.startsWith('/help/') ? 'text-menx-primary translate-x-0.5' : 'text-menx-border group-hover:text-menx-text-muted group-hover:translate-x-0.5'}`} />
              </Link>

              {/* Returns & Exchanges */}
              <Link
                to="/returns"
                onClick={() => setMobileMenuOpen(false)}
                className={`min-h-[44px] flex items-center justify-between py-2.5 px-3 rounded-xl transition-all duration-200 group ${
                  path === '/returns' || path.startsWith('/returns/')
                    ? 'bg-menx-primary/10 border border-menx-primary/30 text-white font-bold'
                    : 'text-menx-text-secondary hover:bg-menx-surface-elevated/70 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    path === '/returns' || path.startsWith('/returns/') ? 'bg-menx-primary/20 text-menx-primary' : 'bg-menx-surface-elevated text-menx-text-muted group-hover:text-menx-primary group-hover:bg-menx-primary/10'
                  }`}>
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <span className="text-xs sm:text-sm">Returns & Exchanges</span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${path === '/returns' || path.startsWith('/returns/') ? 'text-menx-primary translate-x-0.5' : 'text-menx-border group-hover:text-menx-text-muted group-hover:translate-x-0.5'}`} />
              </Link>

              {/* My Support Requests */}
              <Link
                to="/support"
                onClick={() => setMobileMenuOpen(false)}
                className={`min-h-[44px] flex items-center justify-between py-2.5 px-3 rounded-xl transition-all duration-200 group ${
                  path === '/support' || path.startsWith('/support/')
                    ? 'bg-menx-primary/10 border border-menx-primary/30 text-white font-bold'
                    : 'text-menx-text-secondary hover:bg-menx-surface-elevated/70 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    path === '/support' || path.startsWith('/support/') ? 'bg-menx-primary/20 text-menx-primary' : 'bg-menx-surface-elevated text-menx-text-muted group-hover:text-menx-primary group-hover:bg-menx-primary/10'
                  }`}>
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <span className="text-xs sm:text-sm">My Support Requests</span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${path === '/support' || path.startsWith('/support/') ? 'text-menx-primary translate-x-0.5' : 'text-menx-border group-hover:text-menx-text-muted group-hover:translate-x-0.5'}`} />
              </Link>
            </div>

            {/* SECTION 3: MY ITEMS */}
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-menx-text-muted px-2.5 block mb-1">
                My Items
              </span>

              {/* Cart */}
              <Link
                to="/cart"
                onClick={() => setMobileMenuOpen(false)}
                className={`min-h-[44px] flex items-center justify-between py-2.5 px-3 rounded-xl transition-all duration-200 group ${
                  path === '/cart'
                    ? 'bg-menx-primary/10 border border-menx-primary/30 text-white font-bold'
                    : 'text-menx-text-secondary hover:bg-menx-surface-elevated/70 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    path === '/cart' ? 'bg-menx-primary/20 text-menx-primary' : 'bg-menx-surface-elevated text-menx-text-muted group-hover:text-menx-primary group-hover:bg-menx-primary/10'
                  }`}>
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <span className="text-xs sm:text-sm">Cart</span>
                </div>
                {cartCount > 0 ? (
                  <span className="bg-menx-primary text-[#0B0F14] text-[10px] font-black rounded-full px-2 py-0.5 min-w-[20px] h-5 flex items-center justify-center shadow-sm">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-menx-border group-hover:text-menx-text-muted" />
                )}
              </Link>

              {/* Wishlist */}
              <Link
                to="/wishlist"
                onClick={() => setMobileMenuOpen(false)}
                className={`min-h-[44px] flex items-center justify-between py-2.5 px-3 rounded-xl transition-all duration-200 group ${
                  path === '/wishlist'
                    ? 'bg-menx-primary/10 border border-menx-primary/30 text-white font-bold'
                    : 'text-menx-text-secondary hover:bg-menx-surface-elevated/70 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    path === '/wishlist' ? 'bg-menx-primary/20 text-menx-primary' : 'bg-menx-surface-elevated text-menx-text-muted group-hover:text-menx-primary group-hover:bg-menx-primary/10'
                  }`}>
                    <Heart className={`w-4 h-4 ${path === '/wishlist' ? 'fill-menx-primary' : ''}`} />
                  </div>
                  <span className="text-xs sm:text-sm">Wishlist</span>
                </div>
                {wishlistCount > 0 ? (
                  <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-extrabold rounded-full px-2 py-0.5 min-w-[20px] h-5 flex items-center justify-center shadow-sm">
                    {wishlistCount > 99 ? '99+' : wishlistCount}
                  </span>
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-menx-border group-hover:text-menx-text-muted" />
                )}
              </Link>
            </div>

            {/* SECTION 4: ACCOUNT (Admin / Staff Only) */}
            {isAdminOrStaff && (
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-menx-text-muted px-2.5 block mb-1">
                  Account
                </span>
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`min-h-[44px] flex items-center justify-between py-2.5 px-3 rounded-xl transition-all duration-200 group ${
                    path === '/admin' || path.startsWith('/admin/')
                      ? 'bg-menx-primary/10 border border-menx-primary/30 text-white font-bold'
                      : 'text-menx-text-secondary hover:bg-menx-surface-elevated/70 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      path === '/admin' || path.startsWith('/admin/') ? 'bg-menx-primary/20 text-menx-primary' : 'bg-menx-surface-elevated text-menx-text-muted group-hover:text-menx-primary group-hover:bg-menx-primary/10'
                    }`}>
                      <LayoutDashboard className="w-4 h-4 text-amber-500" />
                    </div>
                    <span className="text-xs sm:text-sm">Admin Dashboard</span>
                  </div>
                  <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/25 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                    Admin
                  </span>
                </Link>
              </div>
            )}

          </div>

          {/* Bottom Fixed Area: Sign Out & Branding */}
          <div className="p-4 border-t border-menx-border/80 bg-menx-surface shrink-0 space-y-3">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full min-h-[44px] flex items-center justify-center py-2.5 px-4 rounded-xl border border-menx-error/30 bg-menx-error/10 hover:bg-menx-error/20 text-menx-error text-xs sm:text-sm font-extrabold transition-all duration-200 active:scale-[0.98]"
              >
                <LogOut className="w-4 h-4 mr-2 shrink-0" />
                <span>Sign Out</span>
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full min-h-[44px] flex items-center justify-center py-2.5 px-4 rounded-xl border border-menx-primary/40 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] text-xs sm:text-sm font-black transition-all duration-200 active:scale-[0.98] shadow-md shadow-menx-primary/15"
              >
                <User className="w-4 h-4 mr-2 shrink-0" />
                <span>Customer Sign In</span>
              </Link>
            )}

            <div className="text-center pt-1">
              <span className="text-[10px] text-menx-text-muted font-mono tracking-wider">
                MENX • Premium Menswear
              </span>
            </div>
          </div>
        </aside>
      </>,
      document.body
    )}

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col pt-16 w-full max-w-full min-w-0">
        {children}
      </main>

      {/* Footer 2.0 */}
      <footer role="contentinfo" aria-label="Site Footer" className="bg-menx-surface border-t border-menx-border pt-10 sm:pt-14 lg:pt-16 pb-8 text-xs text-menx-text-secondary mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Main Footer Content Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-8 pb-10 sm:pb-12">
            
            {/* 1. BRAND SECTION (Full width on mobile, 4/12 on desktop) */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-4 space-y-3.5 pr-0 lg:pr-6">
              <Link 
                to="/" 
                className="inline-flex items-center space-x-1.5 group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-menx-primary rounded-lg"
                aria-label="MENX Home"
              >
                <span className="text-2xl sm:text-3xl font-black tracking-wider text-white">
                  MEN<span className="text-menx-primary">X</span>
                </span>
              </Link>
              <div className="space-y-1.5">
                <p className="text-xs sm:text-sm font-bold text-white/90 tracking-wide uppercase font-sans">
                  Premium Menswear &amp; Lifestyle
                </p>
                <p className="text-xs text-menx-text-muted leading-relaxed italic max-w-sm">
                  &ldquo;Modern menswear for everyday confidence.&rdquo;
                </p>
              </div>
            </div>

            {/* 2. SHOP COLUMN */}
            <nav aria-label="Shop Categories" className="col-span-1 lg:col-span-3 space-y-3.5">
              <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center justify-between">
                <span>Shop</span>
              </h3>
              <ul className="space-y-2">
                {[
                  { name: 'All Products', href: '/' },
                  { name: 'Footwear', href: '/?category=footwear' },
                  { name: 'Shirts', href: '/?category=shirts' },
                  { name: 'T-Shirts', href: '/?category=t-shirts' },
                  { name: 'Trousers', href: '/?category=trousers' },
                  { name: 'Jeans', href: '/?category=jeans' },
                  { name: 'Jackets', href: '/?category=jackets' },
                  { name: 'Accessories', href: '/?category=accessories' },
                ].map((item) => (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className="group flex items-center justify-between text-xs text-menx-text-secondary hover:text-menx-primary py-0.5 transition-all"
                    >
                      <span className="group-hover:translate-x-0.5 transition-transform">{item.name}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-menx-text-muted/40 group-hover:text-menx-primary group-hover:translate-x-0.5 transition-all sm:hidden" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* 3. CUSTOMER COLUMN */}
            <nav aria-label="Customer Services" className="col-span-1 lg:col-span-2 space-y-3.5">
              <h3 className="text-xs font-black uppercase tracking-widest text-white">
                Customer
              </h3>
              <ul className="space-y-2">
                {[
                  { name: 'Orders', href: '/orders' },
                  { name: 'Returns & Exchanges', href: '/returns' },
                  { name: 'Wishlist', href: '/wishlist' },
                  { name: 'My Account', href: '/profile' },
                ].map((item) => (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className="group flex items-center justify-between text-xs text-menx-text-secondary hover:text-menx-primary py-0.5 transition-all"
                    >
                      <span className="group-hover:translate-x-0.5 transition-transform">{item.name}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-menx-text-muted/40 group-hover:text-menx-primary group-hover:translate-x-0.5 transition-all sm:hidden" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* 4. HELP & SUPPORT COLUMN & SUPPORT CARD */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 space-y-5">
              <nav aria-label="Help and Support" className="space-y-3.5">
                <h3 className="text-xs font-black uppercase tracking-widest text-white">
                  Help &amp; Support
                </h3>
                <ul className="space-y-2">
                  {[
                    { name: 'Help Center', href: '/help' },
                    { name: 'Support Requests', href: '/support' },
                    { name: 'Contact', href: '/help' },
                  ].map((item) => (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        className="group flex items-center justify-between text-xs text-menx-text-secondary hover:text-menx-primary py-0.5 transition-all"
                      >
                        <span className="group-hover:translate-x-0.5 transition-transform">{item.name}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-menx-text-muted/40 group-hover:text-menx-primary group-hover:translate-x-0.5 transition-all sm:hidden" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Dedicated Support Area */}
              <div className="bg-menx-surface-elevated/50 border border-menx-border/80 hover:border-menx-primary/40 rounded-2xl p-4 space-y-2.5 transition-all shadow-sm">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-menx-primary/10 border border-menx-primary/20 flex items-center justify-center text-menx-primary shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">Need Help?</h4>
                    <p className="text-[11px] text-menx-text-muted">Our support team is here to help.</p>
                  </div>
                </div>
                <div>
                  <a
                    href="mailto:menx001@gmail.com"
                    className="inline-flex items-center text-sm sm:text-base font-mono font-extrabold text-menx-primary hover:text-menx-primary-hover hover:underline tracking-normal transition-colors pt-0.5 break-all"
                    aria-label="Email MENX support at menx001@gmail.com"
                  >
                    menx001@gmail.com
                  </a>
                </div>
              </div>
            </div>

          </div>

          {/* FOOTER BOTTOM: Full-width divider & Copyright */}
          <div className="border-t border-menx-border/80 pt-6 text-center">
            <p className="text-menx-text-muted text-[11px] sm:text-xs">
              &copy; 2026 MENX Talapudi. All Rights Reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
