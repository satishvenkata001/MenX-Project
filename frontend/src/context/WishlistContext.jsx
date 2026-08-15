import React, { createContext, useState, useEffect, useContext } from 'react';
import { api } from '../utils/api.js';
import { useAuth } from './AuthContext.jsx';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function loadWishlist() {
    if (!isAuthenticated) {
      setWishlist([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/wishlist');
      setWishlist(res.data || []);
    } catch (err) {
      console.error('Failed to load wishlist:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Load wishlist when authentication state changes
  useEffect(() => {
    loadWishlist();
  }, [isAuthenticated]);

  async function addToWishlist(productId) {
    if (!isAuthenticated) {
      throw new Error('Please sign in to add items to your wishlist');
    }
    setError(null);
    try {
      await api.post('/wishlist/items', { productId });
      await loadWishlist();
    } catch (err) {
      console.error('Failed to add to wishlist:', err.message);
      setError(err.message);
      throw err;
    }
  }

  async function removeFromWishlist(productId) {
    if (!isAuthenticated) return;
    setError(null);
    try {
      await api.delete(`/wishlist/items/${productId}`);
      await loadWishlist();
    } catch (err) {
      console.error('Failed to remove from wishlist:', err.message);
      setError(err.message);
      throw err;
    }
  }

  function isInWishlist(productId) {
    return wishlist.some(item => item.product_id === productId || item.product?.id === productId);
  }

  const value = {
    wishlist,
    loading,
    error,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    refreshWishlist: loadWishlist
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
