import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { Menu, X, User, ShoppingBag, Heart, LogOut, LayoutDashboard, Shield } from 'lucide-react';

export default function BaseLayout({ children }) {
  const { user, logout, isAdminOrStaff, isAuthenticated } = useAuth();
  const { wishlist } = useWishlist();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
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
                  <div className="flex items-center space-x-2 text-sm text-gray-300">
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
                  </div>
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
          <div className="md:hidden bg-gray-900 border-b border-gray-800 px-4 pt-2 pb-4 space-y-2 text-sm font-medium">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md hover:bg-gray-800 text-gray-300 hover:text-amber-500 transition-colors"
            >
              Shop
            </Link>
            {isAuthenticated && (
              <Link
                to="/wishlist"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-gray-800 text-gray-300 hover:text-amber-500 transition-colors"
              >
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
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-gray-800 text-gray-300 hover:text-amber-500 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4 text-amber-500" />
                <span>Admin Dashboard</span>
              </Link>
            )}
            <hr className="border-gray-800 my-2" />
            {isAuthenticated ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 px-3 py-1">
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-amber-500 font-semibold border border-gray-700">
                    {user.first_name ? user.first_name[0].toUpperCase() : 'U'}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-200">{user.first_name} {user.last_name || ''}</div>
                    <div className="text-xs text-gray-400">{user.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center space-x-2 w-full text-left px-3 py-2 rounded-md hover:bg-red-500/10 text-red-400 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center space-x-2 w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors"
              >
                <User className="w-4 h-4" />
                <span>Sign In</span>
              </Link>
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
