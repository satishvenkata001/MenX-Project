import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminRoute({ children }) {
  const { isAuthenticated, isAdminOrStaff, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-menx-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-menx-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdminOrStaff) {
    return (
      <div className="min-h-screen bg-menx-bg text-menx-text flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-menx-surface border border-menx-border rounded-2xl p-8 shadow-2xl space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-menx-error/10 text-menx-error font-bold text-xl border border-menx-error/20">
            !
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Access Denied</h2>
          <p className="text-sm text-menx-text-secondary">
            You do not have the required administrative or staff permissions to view this portal.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full py-2 px-4 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] font-semibold rounded-lg transition-colors duration-200"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  return children;
}
