import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { WishlistProvider } from './context/WishlistContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// Core public routes - loaded eagerly for instant FCP / LCP
import Home from './pages/Home.jsx';

// Route-level code-splitting for heavy customer routes
const ProductDetail = lazy(() => import('./pages/ProductDetail.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));

// Secondary & Admin routes - lazy loaded with Suspense code splitting
const Login = lazy(() => import('./pages/Login.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const Wishlist = lazy(() => import('./pages/Wishlist.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess.jsx'));
const OrderHistory = lazy(() => import('./pages/OrderHistory.jsx'));
const OrderDetails = lazy(() => import('./pages/OrderDetails.jsx'));
const RequestReturn = lazy(() => import('./pages/RequestReturn.jsx'));
const ReturnHistory = lazy(() => import('./pages/ReturnHistory.jsx'));
const ReturnDetails = lazy(() => import('./pages/ReturnDetails.jsx'));
const HelpCenter = lazy(() => import('./pages/HelpCenter.jsx'));
const MySupport = lazy(() => import('./pages/MySupport.jsx'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));

// Lightweight, sleek route transition loading fallback that avoids layout jumping
function PageFallback() {
  return (
    <div className="min-h-screen bg-menx-bg w-full">
      <div className="w-full h-1 bg-menx-surface overflow-hidden">
        <div className="w-full h-full bg-menx-primary animate-pulse" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <WishlistProvider>
            <CartProvider>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  {/* Public customer routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/help" element={<HelpCenter />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Login />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/products/:slug" element={<ProductDetail />} />
                  <Route path="/cart" element={<Cart />} />

                  {/* Protected customer routes */}
                  <Route
                    path="/support"
                    element={
                      <ProtectedRoute>
                        <MySupport />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/wishlist"
                    element={
                      <ProtectedRoute>
                        <Wishlist />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/account"
                    element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/checkout"
                    element={
                      <ProtectedRoute>
                        <Checkout />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/order-success/:orderId"
                    element={
                      <ProtectedRoute>
                        <OrderSuccess />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/orders"
                    element={
                      <ProtectedRoute>
                        <OrderHistory />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/orders/:orderId"
                    element={
                      <ProtectedRoute>
                        <OrderDetails />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/returns/new"
                    element={
                      <ProtectedRoute>
                        <RequestReturn />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/returns"
                    element={
                      <ProtectedRoute>
                        <ReturnHistory />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/returns/:returnId"
                    element={
                      <ProtectedRoute>
                        <ReturnDetails />
                      </ProtectedRoute>
                    }
                  />

                  {/* Protected admin/staff portal routes */}
                  <Route
                    path="/admin"
                    element={
                      <AdminRoute>
                        <AdminDashboard />
                      </AdminRoute>
                    }
                  />

                  {/* Catch-all route redirecting back home */}
                  <Route path="*" element={<Home />} />
                </Routes>
              </Suspense>
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

