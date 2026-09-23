import React, { createContext, useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import { api } from '../utils/api.js';
import { useAuth } from './AuthContext.jsx';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutatingIdsRef = useRef(new Set());
  const wishlistRef = useRef(wishlist);
  wishlistRef.current = wishlist;

  const loadWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setWishlist([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/wishlist');
      const itemsList = Array.isArray(res.data)
        ? res.data
        : (Array.isArray(res.data?.items)
          ? res.data.items
          : (Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : [])));
      setWishlist(itemsList);
    } catch (err) {
      console.error('Failed to load wishlist:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Load wishlist when authentication state changes
  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  // Fast O(1) Set of all product IDs present in wishlist
  const wishlistIdsSet = useMemo(() => {
    const set = new Set();
    for (const item of wishlist) {
      if (item.productId) set.add(item.productId);
      if (item.product_id) set.add(item.product_id);
      if (item.product?.id) set.add(item.product?.id);
      if (item.product?.productId) set.add(item.product?.productId);
      if (item.id) set.add(item.id);
    }
    return set;
  }, [wishlist]);

  const isInWishlist = useCallback((productId) => {
    if (!productId) return false;
    return wishlistIdsSet.has(productId);
  }, [wishlistIdsSet]);

  const addToWishlist = useCallback(async (productId, productMeta = null) => {
    if (!isAuthenticated) {
      throw new Error('Please sign in to add items to your wishlist');
    }
    if (!productId || mutatingIdsRef.current.has(productId)) return;

    // Check if already in current wishlist
    const currentList = wishlistRef.current;
    const isAlreadyPresent = currentList.some(item => 
      item.productId === productId || 
      item.product_id === productId || 
      item.product?.id === productId ||
      item.product?.productId === productId ||
      item.id === productId
    );
    if (isAlreadyPresent) return;

    mutatingIdsRef.current.add(productId);
    setError(null);

    const previousWishlist = currentList;
    // Optimistic addition
    const optimisticItem = {
      id: `temp-${productId}-${Date.now()}`,
      productId,
      product_id: productId,
      product: productMeta || (typeof productId === 'object' ? productId : null),
      ...(productMeta ? {
        title: productMeta.title,
        slug: productMeta.slug,
        thumbnailUrl: productMeta.thumbnailUrl || productMeta.images?.[0]?.image_url,
        brand: productMeta.brand,
        category: productMeta.category,
        subcategory: productMeta.subcategory,
        price: productMeta.price || { mrp: productMeta.base_mrp, sellingPrice: productMeta.base_price }
      } : {}),
      created_at: new Date().toISOString()
    };
    setWishlist(prev => [optimisticItem, ...prev]);

    try {
      const res = await api.post('/wishlist/items', { productId });
      const createdItem = res.data?.item || res.data;
      if (createdItem) {
        setWishlist(prev => prev.map(item => 
          (item.productId === productId || item.product_id === productId || item.id === optimisticItem.id) 
            ? {
                ...item,
                ...createdItem,
                productId,
                product_id: productId,
                product: createdItem.product || item.product
              } 
            : item
        ));
      }
      return createdItem;
    } catch (err) {
      console.error('Failed to add to wishlist:', err.message);
      setError(err.message);
      // Rollback to previous state on error
      setWishlist(previousWishlist);
      throw err;
    } finally {
      mutatingIdsRef.current.delete(productId);
    }
  }, [isAuthenticated]);

  const removeFromWishlist = useCallback(async (productId) => {
    if (!isAuthenticated || !productId || mutatingIdsRef.current.has(productId)) return;

    mutatingIdsRef.current.add(productId);
    setError(null);
    const previousWishlist = wishlistRef.current;

    // Optimistically update UI
    setWishlist(prev => prev.filter(item => 
      item.productId !== productId && 
      item.product_id !== productId && 
      item.product?.id !== productId &&
      item.id !== productId
    ));

    try {
      await api.delete(`/wishlist/items/${productId}`);
    } catch (err) {
      console.error('Failed to remove from wishlist:', err.message);
      setError(err.message);
      // Rollback to previous state on error
      setWishlist(previousWishlist);
      throw err;
    } finally {
      mutatingIdsRef.current.delete(productId);
    }
  }, [isAuthenticated]);

  const value = useMemo(() => ({
    wishlist,
    loading,
    error,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    refreshWishlist: loadWishlist
  }), [wishlist, loading, error, addToWishlist, removeFromWishlist, isInWishlist, loadWishlist]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
