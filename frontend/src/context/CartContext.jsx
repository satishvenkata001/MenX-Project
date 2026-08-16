import React, { createContext, useState, useEffect, useContext } from 'react';
import { api } from '../utils/api.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function loadCart() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/cart');
      setCart(res.data);
    } catch (err) {
      console.error('Failed to load cart:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Reload cart whenever authentication state changes
  useEffect(() => {
    loadCart();
  }, [isAuthenticated]);

  async function addToCart(variantId, quantity = 1, outfitId = null) {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/cart/items', { variantId, quantity, outfitId });
      setCart(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to add to cart:', err.message);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function updateQuantity(cartItemId, quantity) {
    setError(null);
    setLoading(true);
    try {
      const res = await api.patch(`/cart/items/${cartItemId}`, { quantity });
      setCart(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to update item quantity:', err.message);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function removeFromCart(cartItemId) {
    setError(null);
    setLoading(true);
    try {
      const res = await api.delete(`/cart/items/${cartItemId}`);
      setCart(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to remove item from cart:', err.message);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function clearCart() {
    setError(null);
    setLoading(true);
    try {
      const res = await api.delete('/cart');
      setCart(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to clear cart:', err.message);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  const value = {
    cart,
    loading,
    error,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    refreshCart: loadCart
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
