import React, { createContext, useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import { api } from '../utils/api.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);

// Helper to recalculate cart summary optimistically
function recalculateSummary(items = []) {
  let totalQuantity = 0;
  let subtotal = 0;
  let mrpSubtotal = 0;

  const validItems = items.map(item => {
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unitPrice || item.variant?.selling_price || 0);
    const mrp = Number(item.mrp || item.variant?.mrp || unitPrice);
    const lineTotal = unitPrice * qty;
    const mrpLineTotal = mrp * qty;

    totalQuantity += qty;
    subtotal += lineTotal;
    mrpSubtotal += mrpLineTotal;

    return {
      ...item,
      quantity: qty,
      lineTotal,
      mrpLineTotal
    };
  });

  const totalDiscount = mrpSubtotal > subtotal ? mrpSubtotal - subtotal : 0;
  const isValidForCheckout = validItems.length > 0 && validItems.every(i => i.isAvailable !== false);

  return {
    items: validItems,
    summary: {
      itemCount: validItems.length,
      totalQuantity,
      subtotal,
      mrpSubtotal,
      totalDiscount,
      isValidForCheckout
    }
  };
}

export function CartProvider({ children }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updatingItemIds, setUpdatingItemIds] = useState(new Set());
  const [error, setError] = useState(null);

  const inFlightLoadRef = useRef(null);
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const updatingItemIdsRef = useRef(new Set());

  const loadCart = useCallback(async () => {
    if (inFlightLoadRef.current) {
      return inFlightLoadRef.current;
    }
    setLoading(true);
    setError(null);
    const loadPromise = api.get('/cart')
      .then(res => {
        setCart(res.data);
        return res.data;
      })
      .catch(err => {
        console.error('Failed to load cart:', err.message);
        setError(err.message);
      })
      .finally(() => {
        inFlightLoadRef.current = null;
        setLoading(false);
      });

    inFlightLoadRef.current = loadPromise;
    return loadPromise;
  }, []);

  // Reload cart only once authentication state is fully resolved
  useEffect(() => {
    if (authLoading) return;
    loadCart();
  }, [authLoading, isAuthenticated, loadCart]);

  const addToCart = useCallback(async (variantId, quantity = 1, outfitId = null) => {
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
  }, []);

  const updateQuantity = useCallback(async (cartItemId, quantity) => {
    if (!cartItemId || quantity < 1 || quantity > 10) return;
    if (updatingItemIdsRef.current.has(cartItemId)) return;

    updatingItemIdsRef.current.add(cartItemId);
    setUpdatingItemIds(new Set(updatingItemIdsRef.current));
    setError(null);

    const previousCart = cartRef.current;
    if (previousCart && previousCart.items) {
      // Optimistic update
      const updatedItems = previousCart.items.map(item => 
        item.id === cartItemId ? { ...item, quantity } : item
      );
      const recalculated = recalculateSummary(updatedItems);
      setCart({
        ...previousCart,
        items: recalculated.items,
        summary: recalculated.summary
      });
    }

    try {
      const res = await api.patch(`/cart/items/${cartItemId}`, { quantity });
      setCart(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to update item quantity:', err.message);
      setError(err.message);
      // Rollback on error
      setCart(previousCart);
      throw err;
    } finally {
      updatingItemIdsRef.current.delete(cartItemId);
      setUpdatingItemIds(new Set(updatingItemIdsRef.current));
    }
  }, []);

  const removeFromCart = useCallback(async (cartItemId) => {
    if (!cartItemId || updatingItemIdsRef.current.has(cartItemId)) return;

    updatingItemIdsRef.current.add(cartItemId);
    setUpdatingItemIds(new Set(updatingItemIdsRef.current));
    setError(null);

    const previousCart = cartRef.current;
    if (previousCart && previousCart.items) {
      // Optimistic removal
      const updatedItems = previousCart.items.filter(item => item.id !== cartItemId);
      const recalculated = recalculateSummary(updatedItems);
      setCart({
        ...previousCart,
        items: recalculated.items,
        summary: recalculated.summary
      });
    }

    try {
      const res = await api.delete(`/cart/items/${cartItemId}`);
      setCart(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to remove item from cart:', err.message);
      setError(err.message);
      // Rollback on error
      setCart(previousCart);
      throw err;
    } finally {
      updatingItemIdsRef.current.delete(cartItemId);
      setUpdatingItemIds(new Set(updatingItemIdsRef.current));
    }
  }, []);

  const clearCart = useCallback(async () => {
    setError(null);
    setLoading(true);
    const previousCart = cartRef.current;
    setCart(prev => prev ? { ...prev, items: [], summary: { itemCount: 0, totalQuantity: 0, subtotal: 0, mrpSubtotal: 0, totalDiscount: 0, isValidForCheckout: false } } : null);
    try {
      const res = await api.delete('/cart');
      setCart(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to clear cart:', err.message);
      setError(err.message);
      setCart(previousCart);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const isItemUpdating = useCallback((cartItemId) => {
    return updatingItemIds.has(cartItemId);
  }, [updatingItemIds]);

  const value = useMemo(() => ({
    cart,
    loading,
    error,
    updatingItemIds,
    isItemUpdating,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    refreshCart: loadCart
  }), [cart, loading, error, updatingItemIds, isItemUpdating, addToCart, updateQuantity, removeFromCart, clearCart, loadCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
