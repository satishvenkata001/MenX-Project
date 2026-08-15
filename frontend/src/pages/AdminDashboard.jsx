import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../utils/api.js';
import { LayoutDashboard, Users, Store, Shield } from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stores, setStores] = useState([]);
  const [productsCount, setProductsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardStats() {
      try {
        // Query stores and products to verify admin backend access
        const [storesRes, productsRes] = await Promise.all([
          api.get('/admin/stores'),
          api.get('/products')
        ]);
        setStores(storesRes.data || []);
        setProductsCount(productsRes.data?.length || 0);
      } catch (err) {
        console.error('Failed to load admin metrics:', err.message);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardStats();
  }, []);

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-800 pb-6 space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-2">
              <LayoutDashboard className="w-8 h-8 text-amber-500" />
              <span>Admin Control Panel</span>
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              Welcome back, {user?.first_name} {user?.last_name || ''}. You are authorized as staff.
            </p>
          </div>
          <div className="inline-flex items-center space-x-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-3 py-1.5 rounded-lg text-sm font-semibold self-start md:self-auto">
            <Shield className="w-4 h-4" />
            <span>Role: {user?.role}</span>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
          </div>
        ) : (
          <>
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Products Stat */}
              <div className="bg-gray-900 border border-gray-850 p-6 rounded-xl flex items-center justify-between shadow-lg">
                <div className="space-y-2">
                  <h3 className="text-gray-400 text-sm font-semibold tracking-wide uppercase">Active Products</h3>
                  <div className="text-3xl font-extrabold text-white">{productsCount}</div>
                </div>
                <div className="p-3 bg-amber-500/10 text-amber-500 rounded-lg">
                  <Users className="w-8 h-8" />
                </div>
              </div>

              {/* Stores Stat */}
              <div className="bg-gray-900 border border-gray-850 p-6 rounded-xl flex items-center justify-between shadow-lg">
                <div className="space-y-2">
                  <h3 className="text-gray-400 text-sm font-semibold tracking-wide uppercase">Operational Stores</h3>
                  <div className="text-3xl font-extrabold text-white">{stores.length}</div>
                </div>
                <div className="p-3 bg-amber-500/10 text-amber-500 rounded-lg">
                  <Store className="w-8 h-8" />
                </div>
              </div>

            </div>

            {/* Managed Stores Table */}
            <div className="bg-gray-900 border border-gray-850 rounded-xl overflow-hidden shadow-lg space-y-6 p-6">
              <h2 className="text-xl font-bold tracking-tight">Registered Outlets & Warehouses</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-gray-855 text-gray-400 uppercase text-xs tracking-wider border-b border-gray-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Store Code</th>
                      <th className="py-3 px-4 font-semibold">Name</th>
                      <th className="py-3 px-4 font-semibold">Type</th>
                      <th className="py-3 px-4 font-semibold">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-850">
                    {stores.map((store) => (
                      <tr key={store.id} className="hover:bg-gray-850/30 transition-colors">
                        <td className="py-4 px-4 font-mono text-amber-500">{store.code}</td>
                        <td className="py-4 px-4 font-medium text-white">{store.name}</td>
                        <td className="py-4 px-4">
                          <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-xs font-semibold font-mono border border-gray-700">
                            {store.type}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-400">
                          {store.city}, {store.state}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>
    </BaseLayout>
  );
}
