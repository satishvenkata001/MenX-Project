import React, { createContext, useState, useEffect, useContext } from 'react';
import { api } from '../utils/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check user session on load
  useEffect(() => {
    async function initAuth() {
      const token = api.getToken();
      if (token) {
        try {
          const res = await api.get('/auth/me');
          if (res.data) {
            setUser({
              ...res.data.user,
              ...res.data.profile
            });
          }
        } catch (err) {
          console.error('Failed to load user profile on init:', err.message);
          api.setToken(null);
        }
      }
      setLoading(false);
    }
    initAuth();
  }, []);

  async function login(email, password) {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const sessionData = res.data;
      api.setToken(sessionData.session?.accessToken);
      
      const profileRes = await api.get('/auth/me');
      if (profileRes.data) {
        setUser({
          ...profileRes.data.user,
          ...profileRes.data.profile
        });
      }

      // Safe guest-to-authenticated cart merging
      const guestToken = localStorage.getItem('menx_guest_token');
      if (guestToken) {
        try {
          await api.post('/cart/merge', { guestToken });
          localStorage.removeItem('menx_guest_token');
        } catch (mergeErr) {
          console.error('Failed to merge guest cart on login:', mergeErr.message);
        }
      }

      setLoading(false);
      return profileRes.data;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  async function signup(email, password, firstName, lastName, phone) {
    setError(null);
    setLoading(true);
    try {
      // Create user signup payload matching backend schemas
      const payload = {
        email,
        password,
        firstName,
        lastName: lastName || null,
        phone: phone || null
      };

      const res = await api.post('/auth/signup', payload);
      setLoading(false);
      return res.data;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  function logout() {
    api.setToken(null);
    setUser(null);
  }

  async function refreshUser() {
    const token = api.getToken();
    if (token) {
      try {
        const res = await api.get('/auth/me');
        if (res.data) {
          setUser({
            ...res.data.user,
            ...res.data.profile
          });
          return res.data;
        }
      } catch (err) {
        console.error('Failed to refresh user profile:', err.message);
      }
    }
    return null;
  }

  const value = {
    user,
    loading,
    error,
    login,
    signup,
    logout,
    refreshUser,
    isAuthenticated: !!user,
    isAdminOrStaff: user && ['SUPER_ADMIN', 'STORE_MANAGER', 'INVENTORY_MANAGER', 'STORE_STAFF'].includes(user.role)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
