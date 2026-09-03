import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { Menu, X, User, ShoppingBag, Heart, LogOut, LayoutDashboard, Shield, Package, RotateCcw, ShoppingCart } from 'lucide-react';

export default function BaseLayout({ children }) {
  const { user, logout, isAdminOrStaff, isAuthenticated } = useAuth();
  const { wishlist } = useWishlist();
  const { cart } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col w-full max-w-full overflow-x-hidden">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <span className="bg-gradient-to-r from-amber-400 to-amber-600 text-black font-extrabold px-3 py-1 rounded text-xl tracking-tight shadow-md">
                  MENX
                </span>
              </Link>
            </div>

            {/* Navigation links - Desktop */}
            <nav className="hidden md:flex space-x-8 items-center text-sm font-medium text-gray-300">
              <Link to="/" className="hover:text-amber-500 transition-colors duration-200">Shop</Link>
              {isAuthenticated && (
                <>
                  <Link to="/orders" className="hover:text-amber-500 transition-colors duration-200">Orders</Link>
                  <Link to="/returns" className="hover:text-amber-500 transition-colors duration-200">Returns</Link>
                </>
              )}
              <Link to="/cart" className="flex items-center space-x-1.5 hover:text-amber-500 transition-colors duration-200">
                <ShoppingBag className="w-4 h-4 text-amber-500" />
                <span>Cart</span>
                {cart?.summary?.totalQuantity > 0 && (
                  <span className="bg-amber-500 text-black text-[10px] font-extrabold rounded-full px-1.5 min-w-[16px] h-4 flex items-center justify-center">
                    {cart.summary.totalQuantity}
                  </span>
                )}
              </Link>
              {isAuthenticated && (
                <Link to="/wishlist" className="flex items-center space-x-1.5 hover:text-amber-500 transition-colors duration-200">
                  <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                  <span>Wishlist</span>
                  {wishlist.length > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {wishlist.length}
                    </span>
                  )}
                </Link>
              )}
              {isAdminOrStaff && (
                <Link to="/admin" className="flex items-center space-x-1 hover:text-amber-500 transition-colors duration-200">
                  <LayoutDashboard className="w-4 h-4 text-amber-500" />
                  <span>Admin Dashboard</span>
                </Link>
              )}
            </nav>

            {/* Action buttons - Desktop */}
            <div className="hidden md:flex items-center space-x-6">
              {isAuthenticated ? (
                <div className="flex items-center space-x-4">
                  <Link to="/profile" className="flex items-center space-x-2 text-sm text-gray-300 hover:text-amber-500 transition-colors duration-200">
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
                    className="p-2 hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded-full transition-colors duration-200"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center space-x-1.5 py-2 px-4 bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-amber-500/10"
                >
                  <User className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>
              )}
            </div>

            {/* Mobile menu trigger */}
            <div className="flex md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-400 hover:text-white focus:outline-none"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-gray-900 border-b border-gray-800 px-4 py-6 space-y-5 text-sm font-medium z-50">
            
            {/* PROFILE SECTION */}
            <div className="bg-gray-950/40 border border-gray-850 p-4 rounded-xl flex items-center space-x-3 shadow-inner">
              {isAuthenticated ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-gray-800 border-2 border-amber-500/20 flex items-center justify-center text-amber-500 text-lg font-bold shadow-md shrink-0">
                    {user.first_name ? user.first_name[0].toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0 flex-grow">
                    <div className="font-bold text-gray-100 truncate text-sm">
                      {user.first_name} {user.last_name || ''}
                    </div>
                    <div className="text-xs text-gray-500 truncate font-mono">{user.email}</div>
                    <Link
                      to="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-[10px] text-amber-500 hover:text-amber-400 font-bold tracking-wider mt-1 block uppercase"
                    >
                      View Profile
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center text-gray-400 text-lg font-bold shadow-md shrink-0">
                    ?
                  </div>
                  <div className="min-w-0 flex-grow">
                    <div className="font-bold text-gray-300 text-sm">Welcome Guest</div>
                    <div className="text-xs text-gray-500">Sign in to check out faster</div>
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-[10px] text-amber-500 hover:text-amber-400 font-bold tracking-wider mt-1 block uppercase"
                    >
                      Sign In Now
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* SHOPPING SECTION */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-gray-500 tracking-widest uppercase px-3 block">
                Shopping
              </span>
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-3 py-2 px-3 rounded-lg transition-all duration-200 group ${
                  path === '/'
                    ? 'bg-amber-500/10 border-l-2 border-amber-500 text-white font-bold'
                    : 'text-gray-400 hover:bg-gray-850 hover:text-white'
                }`}
              >
                <ShoppingBag className={`w-4 h-4 transition-colors duration-200 ${path === '/' ? 'text-amber-500' : 'text-gray-500 group-hover:text-amber-500'}`} />
                <span>Shop</span>
              </Link>
              {isAuthenticated && (
                <Link
                  to="/orders"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 py-2 px-3 rounded-lg transition-all duration-200 group ${
                    path === '/orders' || path.startsWith('/orders/')
                      ? 'bg-amber-500/10 border-l-2 border-amber-500 text-white font-bold'
                      : 'text-gray-400 hover:bg-gray-850 hover:text-white'
                  }`}
                >
                  <Package className={`w-4 h-4 transition-colors duration-200 ${path === '/orders' || path.startsWith('/orders/') ? 'text-amber-500' : 'text-gray-500 group-hover:text-amber-500'}`} />
                  <span>Orders</span>
                </Link>
              )}
            </div>

            {/* HELP SECTION */}
            {isAuthenticated && (
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-gray-500 tracking-widest uppercase px-3 block">
                  Help
                </span>
                <Link
                  to="/returns"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 py-2 px-3 rounded-lg transition-all duration-200 group ${
                    path === '/returns' || path.startsWith('/returns/')
                      ? 'bg-amber-500/10 border-l-2 border-amber-500 text-white font-bold'
                      : 'text-gray-400 hover:bg-gray-850 hover:text-white'
                  }`}
                >
                  <RotateCcw className={`w-4 h-4 transition-colors duration-200 ${path === '/returns' || path.startsWith('/returns/') ? 'text-amber-500' : 'text-gray-500 group-hover:text-amber-500'}`} />
                  <span>Returns & Exchanges</span>
                </Link>
              </div>
            )}

            {/* MY ITEMS SECTION */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-gray-500 tracking-widest uppercase px-3 block">
                My Items
              </span>
              <Link
                to="/cart"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between py-2 px-3 rounded-lg transition-all duration-200 group ${
                  path === '/cart'
                    ? 'bg-amber-500/10 border-l-2 border-amber-500 text-white font-bold'
                    : 'text-gray-400 hover:bg-gray-850 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <ShoppingCart className={`w-4 h-4 transition-colors duration-200 ${path === '/cart' ? 'text-amber-500' : 'text-gray-500 group-hover:text-amber-500'}`} />
                  <span>Cart</span>
                </div>
                {cart?.summary?.totalQuantity > 0 && (
                  <span className="bg-amber-500 text-black text-[10px] font-extrabold rounded-full px-2 py-0.5 h-4.5 flex items-center justify-center">
                    {cart.summary.totalQuantity}
                  </span>
                )}
              </Link>
              {isAuthenticated && (
                <Link
                  to="/wishlist"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between py-2 px-3 rounded-lg transition-all duration-200 group ${
                    path === '/wishlist'
                      ? 'bg-amber-500/10 border-l-2 border-amber-500 text-white font-bold'
                      : 'text-gray-400 hover:bg-gray-850 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Heart className={`w-4 h-4 transition-colors duration-200 ${path === '/wishlist' ? 'text-amber-500 fill-amber-500/10' : 'text-gray-500 group-hover:text-amber-500'}`} />
                    <span>Wishlist</span>
                  </div>
                  {wishlist.length > 0 && (
                    <span className="bg-red-500/20 text-red-400 text-[10px] font-bold rounded-full px-2 py-0.5 h-4.5 flex items-center justify-center border border-red-500/20">
                      {wishlist.length}
                    </span>
                  )}
                </Link>
              )}
            </div>

            {/* ACCOUNT SECTION (ADMIN ONLY) */}
            {isAdminOrStaff && (
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-gray-500 tracking-widest uppercase px-3 block">
                  Account
                </span>
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 py-2 px-3 rounded-lg transition-all duration-200 group ${
                    path === '/admin'
                      ? 'bg-amber-500/10 border-l-2 border-amber-500 text-white font-bold'
                      : 'text-gray-400 hover:bg-gray-850 hover:text-white'
                  }`}
                >
                  <LayoutDashboard className={`w-4 h-4 transition-colors duration-200 ${path === '/admin' ? 'text-amber-500' : 'text-gray-500 group-hover:text-amber-500'}`} />
                  <span>Admin Dashboard</span>
                </Link>
              </div>
            )}

            {/* SIGN OUT SECTION */}
            {isAuthenticated && (
              <div className="pt-3 border-t border-gray-800">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center space-x-3 w-full text-left py-2 px-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors duration-200"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-850 py-6 text-center text-xs text-gray-500">
        <p>&copy; {new Date().getFullYear()} MENX Talapudi. All Rights Reserved.</p>
      </footer>
    </div>
  );
}
