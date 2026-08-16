import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../utils/api.js';
import { 
  LayoutDashboard, Store, ShoppingBag, RotateCcw, AlertTriangle, 
  Search, Eye, Shield, Check, X, CreditCard, ChevronRight
} from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  
  // Dashboard Tabs
  const [activeTab, setActiveTab] = useState('overview');

  // Stats
  const [stores, setStores] = useState([]);
  const [productsCount, setProductsCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [returnsCount, setReturnsCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  // Tab - Orders
  const [orders, setOrders] = useState([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [orderPage, setOrderPage] = useState(1);
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [codAmount, setCodAmount] = useState('');
  const [updatingOrderStatus, setUpdatingOrderStatus] = useState(false);
  const [recordingCod, setRecordingCod] = useState(false);

  // Tab - Returns
  const [returns, setReturns] = useState([]);
  const [returnsTotal, setReturnsTotal] = useState(0);
  const [returnPage, setReturnPage] = useState(1);
  const [returnStatusFilter, setReturnStatusFilter] = useState('');
  const [returnSearch, setReturnSearch] = useState('');
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [returnTransitionStatus, setReturnTransitionStatus] = useState('');
  const [returnComment, setReturnComment] = useState('');
  const [returnItemsConditions, setReturnItemsConditions] = useState({}); // itemId -> 'RESELLABLE' | 'DAMAGED' | 'DEFECTIVE'
  const [updatingReturnStatus, setUpdatingReturnStatus] = useState(false);

  // Tab - Low Stock
  const [lowStockItems, setLowStockItems] = useState([]);
  const [lowStockTotal, setLowStockTotal] = useState(0);
  const [lowStockPage, setLowStockPage] = useState(1);
  const [loadingLowStock, setLoadingLowStock] = useState(false);

  // Determine permissions based on exact backend constants
  const hasInventoryRole = user && ['INVENTORY_MANAGER', 'STORE_MANAGER', 'SUPER_ADMIN'].includes(user.role);
  const hasOrderRole = user && ['STORE_STAFF', 'ORDER_MANAGER', 'STORE_MANAGER', 'SUPER_ADMIN'].includes(user.role);

  // 1. Fetch Overview stats
  async function loadOverviewStats() {
    setLoadingStats(true);
    try {
      // Products count (public)
      const productsRes = await api.get('/products');
      setProductsCount(productsRes.data?.length || 0);

      // Stores count (inventory role required)
      if (hasInventoryRole) {
        const storesRes = await api.get('/admin/stores');
        setStores(storesRes.data || []);
      }

      // Orders stats (order role required)
      if (hasOrderRole) {
        const ordersRes = await api.get('/admin/orders?limit=1');
        setOrdersCount(ordersRes.data?.total || 0);

        const returnsRes = await api.get('/admin/returns?limit=1&status=REQUESTED');
        setReturnsCount(returnsRes.data?.pagination?.total || returnsRes.data?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load overview metrics:', err.message);
    } finally {
      setLoadingStats(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadOverviewStats();
    }
  }, [user, isAuthenticated]);

  // 2. Fetch Orders
  async function fetchOrdersList() {
    if (!hasOrderRole) return;
    setLoadingOrders(true);
    try {
      const query = `/admin/orders?page=${orderPage}&limit=8${orderStatusFilter ? `&status=${orderStatusFilter}` : ''}${orderSearch ? `&search=${orderSearch}` : ''}`;
      const res = await api.get(query);
      setOrders(res.data?.orders || []);
      setOrdersTotal(res.data?.total || 0);
    } catch (err) {
      console.error('Failed to fetch admin orders list:', err.message);
    } finally {
      setLoadingOrders(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrdersList();
    }
  }, [activeTab, orderPage, orderStatusFilter, orderSearch]);

  // 3. Fetch Returns
  async function fetchReturnsList() {
    if (!hasOrderRole) return;
    setLoadingReturns(true);
    try {
      const query = `/admin/returns?page=${returnPage}&limit=8${returnStatusFilter ? `&status=${returnStatusFilter}` : ''}${returnSearch ? `&search=${returnSearch}` : ''}`;
      const res = await api.get(query);
      setReturns(res.data?.returns || []);
      setReturnsTotal(res.data?.pagination?.total || res.data?.total || 0);
    } catch (err) {
      console.error('Failed to fetch admin returns list:', err.message);
    } finally {
      setLoadingReturns(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'returns') {
      fetchReturnsList();
    }
  }, [activeTab, returnPage, returnStatusFilter, returnSearch]);

  // 4. Fetch Low Stock
  async function fetchLowStockList() {
    if (!hasInventoryRole) return;
    setLoadingLowStock(true);
    try {
      const res = await api.get(`/admin/inventory/low-stock?page=${lowStockPage}&limit=10`);
      setLowStockItems(res.data || []);
      setLowStockTotal(res.pagination?.total || res.data?.length || 0);
    } catch (err) {
      console.error('Failed to fetch low stock items:', err.message);
    } finally {
      setLoadingLowStock(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'low-stock') {
      fetchLowStockList();
    }
  }, [activeTab, lowStockPage]);

  // Handle Order Status transition
  const handleUpdateOrderStatus = async (status) => {
    if (!selectedOrder) return;
    setUpdatingOrderStatus(true);
    try {
      const res = await api.patch(`/admin/orders/${selectedOrder.id}/status`, { status });
      // Update selected order details view
      setSelectedOrder(res.data);
      // Reload order list
      fetchOrdersList();
      alert('Order status transitioned successfully');
    } catch (err) {
      alert(err.message || 'Failed to update order status');
    } finally {
      setUpdatingOrderStatus(false);
    }
  };

  // Handle COD collection recording
  const handleRecordCod = async (e) => {
    e.preventDefault();
    if (!selectedOrder || !codAmount) return;
    
    const amount = parseFloat(codAmount);
    if (isNaN(amount) || amount < 0) {
      alert('Please enter a valid cash amount.');
      return;
    }

    setRecordingCod(true);
    try {
      const res = await api.post(`/admin/orders/${selectedOrder.id}/cod-collection`, {
        amountCollected: amount
      });
      setSelectedOrder(res.data);
      setCodAmount('');
      fetchOrdersList();
      alert('Cash collection recorded successfully');
    } catch (err) {
      alert(err.message || 'Failed to record cash collection');
    } finally {
      setRecordingCod(false);
    }
  };

  // Handle Return Status transition
  const handleUpdateReturnStatus = async (e) => {
    e.preventDefault();
    if (!selectedReturn || !returnTransitionStatus) return;

    // Build items conditions if transition target is RECEIVED_IN_STORE or COMPLETED
    const conditionsArray = [];
    if (['RECEIVED_IN_STORE', 'COMPLETED'].includes(returnTransitionStatus)) {
      const missingConditions = selectedReturn.items.some(
        item => !returnItemsConditions[item.id]
      );

      if (missingConditions) {
        alert('Please specify the condition on receipt for all items.');
        return;
      }

      selectedReturn.items.forEach(item => {
        conditionsArray.push({
          returnItemId: item.id,
          condition: returnItemsConditions[item.id]
        });
      });
    }

    setUpdatingReturnStatus(true);
    try {
      const res = await api.post(`/admin/returns/${selectedReturn.id}/status`, {
        status: returnTransitionStatus,
        comment: returnComment.trim() || null,
        itemsCondition: conditionsArray.length > 0 ? conditionsArray : null
      });

      setSelectedReturn(res.data);
      setReturnTransitionStatus('');
      setReturnComment('');
      fetchReturnsList();
      alert('Return status transitioned successfully');
    } catch (err) {
      alert(err.message || 'Failed to transition return status');
    } finally {
      setUpdatingReturnStatus(false);
    }
  };

  const openReturnDetailModal = (ret) => {
    setSelectedReturn(ret);
    // Initialize item conditions mappings
    const initialConds = {};
    (ret.items || []).forEach(i => {
      initialConds[i.id] = i.condition_on_receipt || 'RESELLABLE';
    });
    setReturnItemsConditions(initialConds);
  };

  // Status badges colors
  const getOrderStatusBadge = (status) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
      case 'CONFIRMED': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'PACKED': return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
      case 'SHIPPED': return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
      case 'OUT_FOR_DELIVERY': return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'DELIVERED': return 'bg-green-500/10 border-green-500/20 text-green-400';
      case 'CANCELLED': return 'bg-red-500/10 border-red-500/20 text-red-400';
      default: return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
    }
  };

  const getReturnStatusBadge = (status) => {
    switch (status) {
      case 'REQUESTED': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'APPROVED': return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
      case 'REJECTED': return 'bg-red-500/10 border-red-500/20 text-red-400';
      case 'PICKUP_SCHEDULED': return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
      case 'RECEIVED_IN_STORE': return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
      case 'COMPLETED': return 'bg-green-500/10 border-green-500/20 text-green-400';
      case 'CANCELLED': return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
    }
  };

  const getValidOrderStatusTransitions = (currentStatus) => {
    const transitions = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PACKED', 'CANCELLED'],
      PACKED: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['OUT_FOR_DELIVERY', 'FAILED_DELIVERY'],
      OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED_DELIVERY', 'CANCELLED'],
      FAILED_DELIVERY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
      DELIVERED: ['RETURN_REQUESTED'],
      RETURN_REQUESTED: ['RETURNED'],
      RETURNED: [],
      CANCELLED: []
    };
    return transitions[currentStatus] || [];
  };

  const getValidReturnStatusTransitions = (currentStatus) => {
    const transitions = {
      REQUESTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
      APPROVED: ['PICKUP_SCHEDULED', 'RECEIVED_IN_STORE', 'CANCELLED'],
      PICKUP_SCHEDULED: ['RECEIVED_IN_STORE', 'CANCELLED'],
      RECEIVED_IN_STORE: ['COMPLETED', 'REJECTED'],
      COMPLETED: [],
      REJECTED: [],
      CANCELLED: []
    };
    return transitions[currentStatus] || [];
  };

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow space-y-8">
        
        {/* Control Panel Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-800 pb-6 space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-2">
              <LayoutDashboard className="w-8 h-8 text-amber-500" />
              <span>Admin Control Panel</span>
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              Authorized session for {user?.first_name} {user?.last_name || ''}.
            </p>
          </div>
          <div className="inline-flex items-center space-x-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-3 py-1.5 rounded-lg text-sm font-semibold self-start md:self-auto uppercase tracking-wide">
            <Shield className="w-4 h-4" />
            <span>Role: {user?.role}</span>
          </div>
        </div>

        {/* Dashboard Tabs Sidebar / Nav Row */}
        <div className="flex border-b border-gray-850 overflow-x-auto text-sm font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-6 border-b-2 transition-all ${
              activeTab === 'overview' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          
          {hasInventoryRole && (
            <button
              onClick={() => setActiveTab('stores')}
              className={`py-3 px-6 border-b-2 transition-all ${
                activeTab === 'stores' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Stores
            </button>
          )}

          {hasOrderRole && (
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-3 px-6 border-b-2 transition-all ${
                activeTab === 'orders' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Fulfillment Orders
            </button>
          )}

          {hasOrderRole && (
            <button
              onClick={() => setActiveTab('returns')}
              className={`py-3 px-6 border-b-2 transition-all ${
                activeTab === 'returns' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Returns & Exchanges
            </button>
          )}

          {hasInventoryRole && (
            <button
              onClick={() => setActiveTab('low-stock')}
              className={`py-3 px-6 border-b-2 transition-all ${
                activeTab === 'low-stock' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Low Stock Warnings
            </button>
          )}
        </div>

        {/* LOADING STATS */}
        {loadingStats ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500"></div>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Stats cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  {/* Products Count */}
                  <div className="bg-gray-900 border border-gray-850 p-6 rounded-2xl flex items-center justify-between shadow-md">
                    <div className="space-y-2">
                      <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Active Products</h3>
                      <div className="text-3xl font-black text-white">{productsCount}</div>
                    </div>
                    <div className="p-3.5 bg-amber-500/10 text-amber-500 rounded-xl">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Operational Stores */}
                  {hasInventoryRole && (
                    <div className="bg-gray-900 border border-gray-850 p-6 rounded-2xl flex items-center justify-between shadow-md">
                      <div className="space-y-2">
                        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Operational Stores</h3>
                        <div className="text-3xl font-black text-white">{stores.length}</div>
                      </div>
                      <div className="p-3.5 bg-amber-500/10 text-amber-500 rounded-xl">
                        <Store className="w-6 h-6" />
                      </div>
                    </div>
                  )}

                  {/* Orders Total count */}
                  {hasOrderRole && (
                    <div className="bg-gray-900 border border-gray-850 p-6 rounded-2xl flex items-center justify-between shadow-md">
                      <div className="space-y-2">
                        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total Orders</h3>
                        <div className="text-3xl font-black text-white">{ordersCount}</div>
                      </div>
                      <div className="p-3.5 bg-amber-500/10 text-amber-500 rounded-xl">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                    </div>
                  )}

                  {/* Pending Returns count */}
                  {hasOrderRole && (
                    <div className="bg-gray-900 border border-gray-850 p-6 rounded-2xl flex items-center justify-between shadow-md">
                      <div className="space-y-2">
                        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Requested Returns</h3>
                        <div className="text-3xl font-black text-white">{returnsCount}</div>
                      </div>
                      <div className="p-3.5 bg-amber-500/10 text-amber-500 rounded-xl">
                        <RotateCcw className="w-6 h-6" />
                      </div>
                    </div>
                  )}

                </div>

                {/* Sub-grid: Welcome info or simple shortcuts */}
                <div className="p-6 bg-gray-900 border border-gray-855 rounded-2xl text-center max-w-xl mx-auto space-y-4 shadow-md">
                  <Shield className="w-12 h-12 text-amber-500 mx-auto" />
                  <h3 className="text-lg font-bold text-white">Manager Fulfilment Center</h3>
                  <p className="text-sm text-gray-400 leading-relaxed font-medium">
                    Use the tabs above to manage customer delivery operations, record Cash on Delivery collections, verify item-level receipt conditions for returns, and view real-time low-stock inventory warnings.
                  </p>
                </div>
              </div>
            )}

            {/* TAB: STORES */}
            {activeTab === 'stores' && hasInventoryRole && (
              <div className="bg-gray-900 border border-gray-855 rounded-2xl overflow-hidden shadow-md p-6 space-y-6">
                <h2 className="text-xl font-bold tracking-tight text-white">Registered Stores & Warehouses</h2>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-300">
                    <thead className="bg-gray-950 text-gray-400 uppercase text-xs font-bold tracking-wider border-b border-gray-800">
                      <tr>
                        <th className="py-3 px-4">Code</th>
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-855">
                      {stores.map((store) => (
                        <tr key={store.id} className="hover:bg-gray-850/20 transition-all font-medium">
                          <td className="py-4 px-4 font-mono text-amber-500">{store.code}</td>
                          <td className="py-4 px-4 text-white">{store.name}</td>
                          <td className="py-4 px-4">
                            <span className="bg-gray-800 border border-gray-700 text-gray-300 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
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
            )}

            {/* TAB: ORDERS */}
            {activeTab === 'orders' && hasOrderRole && (
              <div className="bg-gray-900 border border-gray-855 rounded-2xl p-6 shadow-md space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-800 pb-4">
                  <h2 className="text-lg font-bold text-white">Fulfillment Orders</h2>
                  
                  {/* Filters / Search bar */}
                  <div className="flex flex-wrap gap-3 items-center text-xs">
                    
                    {/* Status filter */}
                    <select
                      value={orderStatusFilter}
                      onChange={(e) => { setOrderStatusFilter(e.target.value); setOrderPage(1); }}
                      className="bg-gray-950 border border-gray-855 rounded-lg p-2.5 text-white font-bold focus:outline-none"
                    >
                      <option value="">All Statuses</option>
                      <option value="PENDING">Pending</option>
                      <option value="CONFIRMED">Confirmed</option>
                      <option value="PACKED">Packed</option>
                      <option value="SHIPPED">Shipped</option>
                      <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>

                    {/* Search bar */}
                    <div className="relative">
                      <input
                        type="text"
                        value={orderSearch}
                        onChange={(e) => { setOrderSearch(e.target.value); setOrderPage(1); }}
                        placeholder="Search by Order # or Phone..."
                        className="bg-gray-955 border border-gray-855 rounded-lg pl-8 pr-3 py-2.5 text-white placeholder-gray-700 focus:outline-none focus:border-amber-500 font-medium"
                      />
                      <Search className="w-3.5 h-3.5 text-gray-600 absolute left-2.5 top-3" />
                    </div>

                  </div>
                </div>

                {loadingOrders ? (
                  <div className="py-20 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t border-amber-500"></div>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 font-medium">
                    No orders matching search filters.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-300">
                        <thead className="bg-gray-950 text-gray-400 uppercase text-xs font-bold tracking-wider border-b border-gray-855">
                          <tr>
                            <th className="py-3 px-4">Order #</th>
                            <th className="py-3 px-4">Customer</th>
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Payment</th>
                            <th className="py-3 px-4 text-right">Total Payable</th>
                            <th className="py-3 px-4 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-855">
                          {orders.map((o) => (
                            <tr key={o.id} className="hover:bg-gray-850/20 transition-all font-medium">
                              <td className="py-4 px-4 font-mono text-amber-500">{o.order_number}</td>
                              <td className="py-4 px-4">
                                <div className="text-white">
                                  {o.customer ? `${o.customer.first_name} ${o.customer.last_name || ''}` : 'Guest'}
                                </div>
                                <div className="text-[11px] text-gray-500 font-mono">{o.customer_phone}</div>
                              </td>
                              <td className="py-4 px-4 text-xs text-gray-400">
                                {new Date(o.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-4 px-4 text-xs">
                                <span className={`px-2 py-0.5 rounded border ${getOrderStatusBadge(o.order_status)}`}>
                                  {o.order_status}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-xs">
                                <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded border border-gray-700 uppercase font-bold text-[9px]">
                                  {o.payment_method} - {o.payment_status}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right text-white font-black">₹{o.total_payable}</td>
                              <td className="py-4 px-4 text-center">
                                <button
                                  onClick={() => setSelectedOrder(o)}
                                  className="inline-flex items-center space-x-1 py-1.5 px-3 bg-gray-955 hover:bg-gray-805 border border-gray-800 rounded-lg text-xs font-bold text-amber-500 transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Review</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination buttons */}
                    <div className="flex justify-between items-center text-xs pt-4 border-t border-gray-855">
                      <span className="text-gray-500 font-medium">
                        Showing {orders.length} of {ordersTotal} orders
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={orderPage === 1}
                          onClick={() => setOrderPage(prev => Math.max(1, prev - 1))}
                          className="px-3.5 py-2 bg-gray-950 hover:bg-gray-855 disabled:bg-gray-950 disabled:text-gray-705 border border-gray-855 rounded-lg font-bold text-white"
                        >
                          Prev
                        </button>
                        <button
                          disabled={orderPage * 8 >= ordersTotal}
                          onClick={() => setOrderPage(prev => prev + 1)}
                          className="px-3.5 py-2 bg-gray-950 hover:bg-gray-855 disabled:bg-gray-950 disabled:text-gray-705 border border-gray-855 rounded-lg font-bold text-white"
                        >
                          Next
                        </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* TAB: RETURNS */}
            {activeTab === 'returns' && hasOrderRole && (
              <div className="bg-gray-900 border border-gray-855 rounded-2xl p-6 shadow-md space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-800 pb-4">
                  <h2 className="text-lg font-bold text-white">Returns & Exchanges</h2>
                  
                  {/* Filters / Search bar */}
                  <div className="flex flex-wrap gap-3 items-center text-xs">
                    
                    {/* Status filter */}
                    <select
                      value={returnStatusFilter}
                      onChange={(e) => { setReturnStatusFilter(e.target.value); setReturnPage(1); }}
                      className="bg-gray-955 border border-gray-855 rounded-lg p-2.5 text-white font-bold focus:outline-none"
                    >
                      <option value="">All Statuses</option>
                      <option value="REQUESTED">Requested</option>
                      <option value="APPROVED">Approved</option>
                      <option value="PICKUP_SCHEDULED">Pickup Scheduled</option>
                      <option value="RECEIVED_IN_STORE">Received in Store</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>

                    {/* Search bar */}
                    <div className="relative">
                      <input
                        type="text"
                        value={returnSearch}
                        onChange={(e) => { setReturnSearch(e.target.value); setReturnPage(1); }}
                        placeholder="Search Return/Order #..."
                        className="bg-gray-955 border border-gray-855 rounded-lg pl-8 pr-3 py-2.5 text-white placeholder-gray-700 focus:outline-none focus:border-amber-500 font-medium"
                      />
                      <Search className="w-3.5 h-3.5 text-gray-600 absolute left-2.5 top-3" />
                    </div>

                  </div>
                </div>

                {loadingReturns ? (
                  <div className="py-20 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t border-amber-500"></div>
                  </div>
                ) : returns.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 font-medium">
                    No return requests matching search filters.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-300">
                        <thead className="bg-gray-950 text-gray-400 uppercase text-xs font-bold tracking-wider border-b border-gray-855">
                          <tr>
                            <th className="py-3 px-4">Return #</th>
                            <th className="py-3 px-4">Order #</th>
                            <th className="py-3 px-4">Customer</th>
                            <th className="py-3 px-4">Type</th>
                            <th className="py-3 px-4">Reason</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-855">
                          {returns.map((r) => (
                            <tr key={r.id} className="hover:bg-gray-850/20 transition-all font-medium">
                              <td className="py-4 px-4 font-mono text-amber-500">{r.return_number}</td>
                              <td className="py-4 px-4 font-mono text-white">{r.order_number}</td>
                              <td className="py-4 px-4">
                                <div className="text-white">{r.first_name} {r.last_name || ''}</div>
                                <div className="text-[11px] text-gray-500 font-mono">{r.email}</div>
                              </td>
                              <td className="py-4 px-4 text-xs font-bold uppercase">{r.request_type}</td>
                              <td className="py-4 px-4 text-xs capitalize">{r.reason.replace(/_/g, ' ')}</td>
                              <td className="py-4 px-4 text-xs">
                                <span className={`px-2 py-0.5 rounded border ${getReturnStatusBadge(r.status)}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <button
                                  onClick={() => openReturnDetailModal(r)}
                                  className="inline-flex items-center space-x-1 py-1.5 px-3 bg-gray-955 hover:bg-gray-805 border border-gray-800 rounded-lg text-xs font-bold text-amber-500 transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Review</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-between items-center text-xs pt-4 border-t border-gray-855">
                      <span className="text-gray-500 font-medium">
                        Showing {returns.length} of {returnsTotal} return requests
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={returnPage === 1}
                          onClick={() => setReturnPage(prev => Math.max(1, prev - 1))}
                          className="px-3.5 py-2 bg-gray-950 hover:bg-gray-855 disabled:bg-gray-955 disabled:text-gray-700 border border-gray-855 rounded-lg font-bold text-white"
                        >
                          Prev
                        </button>
                        <button
                          disabled={returnPage * 8 >= returnsTotal}
                          onClick={() => setReturnPage(prev => prev + 1)}
                          className="px-3.5 py-2 bg-gray-950 hover:bg-gray-855 disabled:bg-gray-955 disabled:text-gray-700 border border-gray-855 rounded-lg font-bold text-white"
                        >
                          Next
                        </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* TAB: LOW STOCK */}
            {activeTab === 'low-stock' && hasInventoryRole && (
              <div className="bg-gray-900 border border-gray-855 rounded-2xl p-6 shadow-md space-y-6">
                <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                  <h2 className="text-lg font-bold text-white flex items-center">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
                    <span>Low Stock Alerts</span>
                  </h2>
                </div>

                {loadingLowStock ? (
                  <div className="py-20 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t border-amber-500"></div>
                  </div>
                ) : lowStockItems.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 font-medium flex items-center justify-center space-x-2">
                    <Check className="w-4 h-4 text-green-400" />
                    <span>All store items are fully stocked. No warnings found.</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-300">
                        <thead className="bg-gray-950 text-gray-400 uppercase text-xs font-bold tracking-wider border-b border-gray-855">
                          <tr>
                            <th className="py-3 px-4">Store Outlet</th>
                            <th className="py-3 px-4">Item SKU</th>
                            <th className="py-3 px-4">Specs</th>
                            <th className="py-3 px-4 text-center">Available Stock</th>
                            <th className="py-3 px-4 text-center">Reserved</th>
                            <th className="py-3 px-4 text-center">Min Threshold</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-855">
                          {lowStockItems.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-850/20 transition-all font-medium text-xs">
                              <td className="py-4 px-4 text-white font-bold">{item.stores?.name || item.store_name}</td>
                              <td className="py-4 px-4 font-mono">{item.product_variants?.sku || item.sku}</td>
                              <td className="py-4 px-4 text-gray-400">
                                Size: {item.product_variants?.size || item.size} | Color: {item.product_variants?.color || item.color}
                              </td>
                              <td className="py-4 px-4 text-center font-bold text-red-400">
                                {item.quantity_available}
                              </td>
                              <td className="py-4 px-4 text-center font-mono">{item.quantity_reserved}</td>
                              <td className="py-4 px-4 text-center text-gray-500 font-mono">10</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>

      {/* OVERLAY: Selected Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-6">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Manage Order #{selectedOrder.order_number}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getOrderStatusBadge(selectedOrder.order_status)}`}>
                  {selectedOrder.order_status}
                </span>
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-lg border border-gray-800 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
              
              {/* Left two columns: Items details */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Product details */}
                <div className="bg-gray-955 border border-gray-855 p-4 rounded-xl space-y-3">
                  <h4 className="font-bold text-white border-b border-gray-855 pb-2">Line Items</h4>
                  <div className="divide-y divide-gray-855">
                    {(selectedOrder.order_items || []).map((item) => (
                      <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 flex justify-between items-center text-xs">
                        <div className="space-y-1">
                          <h5 className="font-bold text-white">{item.product_title_snapshot}</h5>
                          <p className="text-gray-500 font-mono">
                            SKU: {item.variant_sku_snapshot} | Size: {item.size_snapshot} | Color: {item.color_snapshot}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-white">₹{item.line_total}</div>
                          <div className="text-[10px] text-gray-500">₹{item.unit_price_snapshot} x {item.quantity}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Snapshot */}
                <div className="bg-gray-955 border border-gray-855 p-4 rounded-xl space-y-2">
                  <h4 className="font-bold text-white border-b border-gray-855 pb-2">Delivery Snapshot</h4>
                  {selectedOrder.shipping_snapshot ? (
                    <div className="text-xs text-gray-400 leading-relaxed font-medium">
                      <div className="font-bold text-white">{selectedOrder.shipping_snapshot.recipient_name}</div>
                      <div>
                        {selectedOrder.shipping_snapshot.address_line1}
                        {selectedOrder.shipping_snapshot.address_line2 && `, ${selectedOrder.shipping_snapshot.address_line2}`}
                        {selectedOrder.shipping_snapshot.landmark && ` (Near ${selectedOrder.shipping_snapshot.landmark})`}
                      </div>
                      <div>{selectedOrder.shipping_snapshot.city}, {selectedOrder.shipping_snapshot.state} - <span className="font-bold text-amber-500">{selectedOrder.shipping_snapshot.postal_code}</span></div>
                      <div className="pt-1">Phone: {selectedOrder.shipping_snapshot.phone_number}</div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">No snapshot found</div>
                  )}
                </div>

              </div>

              {/* Right column: Fulfilment controls */}
              <div className="space-y-4">
                
                {/* Price Summary */}
                <div className="bg-gray-955 border border-gray-855 p-4 rounded-xl space-y-2.5">
                  <h4 className="font-bold text-white border-b border-gray-855 pb-2">Financials</h4>
                  <div className="space-y-2 text-xs text-gray-400">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₹{selectedOrder.subtotal_amount}</span>
                    </div>
                    {Number(selectedOrder.discount_amount) > 0 && (
                      <div className="flex justify-between text-green-400">
                        <span>Discount:</span>
                        <span>-₹{selectedOrder.discount_amount}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Shipping Fee:</span>
                      <span>₹{selectedOrder.delivery_fee}</span>
                    </div>
                    <div className="border-t border-gray-800 pt-2 flex justify-between font-black text-sm text-white">
                      <span>Authoritative Total:</span>
                      <span className="text-amber-500">₹{selectedOrder.total_payable}</span>
                    </div>
                  </div>
                </div>

                {/* Status Transitions Form */}
                {getValidOrderStatusTransitions(selectedOrder.order_status).length > 0 && (
                  <div className="bg-gray-955 border border-gray-855 p-4 rounded-xl space-y-3">
                    <h4 className="font-bold text-white border-b border-gray-855 pb-2">Transition Order Status</h4>
                    <div className="flex flex-col gap-2">
                      {getValidOrderStatusTransitions(selectedOrder.order_status).map((target) => (
                        <button
                          key={target}
                          disabled={updatingOrderStatus}
                          onClick={() => handleUpdateOrderStatus(target)}
                          className="w-full py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black border border-amber-500/20 rounded-lg text-xs font-bold transition-all duration-150 flex items-center justify-center space-x-1"
                        >
                          {updatingOrderStatus ? (
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-t border-amber-500" />
                          ) : (
                            <>
                              <span>Move to {target}</span>
                              <ChevronRight className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* COD Cash collection form */}
                {selectedOrder.payment_method === 'COD' && selectedOrder.payment_status === 'PENDING' && (
                  <div className="bg-gray-955 border border-gray-855 p-4 rounded-xl space-y-3">
                    <h4 className="font-bold text-white border-b border-gray-855 pb-2 flex items-center">
                      <CreditCard className="w-4 h-4 text-amber-500 mr-1.5" />
                      <span>Record COD Collection</span>
                    </h4>
                    <form onSubmit={handleRecordCod} className="space-y-2">
                      <div>
                        <label className="text-[10px] text-gray-505 font-bold block mb-1">Cash amount collected (₹) *</label>
                        <input
                          type="number"
                          required
                          value={codAmount}
                          onChange={(e) => setCodAmount(e.target.value)}
                          placeholder={`E.g., ${selectedOrder.total_payable}`}
                          className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono font-bold"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={recordingCod}
                        className="w-full py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-800 text-black font-extrabold rounded-lg text-xs transition-colors"
                      >
                        {recordingCod ? 'Processing...' : 'Collect Cash & Mark Paid'}
                      </button>
                    </form>
                  </div>
                )}

              </div>

            </div>

          </div>
        </div>
      )}

      {/* OVERLAY: Selected Return Details Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-6">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Manage Return {selectedReturn.return_number}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getReturnStatusBadge(selectedReturn.status)}`}>
                  {selectedReturn.status}
                </span>
              </h3>
              <button
                onClick={() => setSelectedReturn(null)}
                className="p-1 rounded-lg border border-gray-800 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
              
              {/* Left two columns: Items details */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Product details */}
                <div className="bg-gray-955 border border-gray-855 p-4 rounded-xl space-y-3">
                  <h4 className="font-bold text-white border-b border-gray-855 pb-2">Return Items</h4>
                  <div className="divide-y divide-gray-855">
                    {(selectedReturn.items || []).map((item) => (
                      <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs">
                        <div className="space-y-1">
                          <h5 className="font-bold text-white">{item.product_title_snapshot}</h5>
                          <p className="text-gray-500 font-mono">
                            SKU: {item.variant_sku_snapshot} | Original Size: {item.size_snapshot} | Color: {item.color_snapshot}
                          </p>
                          {selectedReturn.request_type === 'EXCHANGE' && (
                            <p className="text-amber-500 font-bold">
                              Exchanging for Variant: {item.replacement_size || 'Size Code ' + item.replacement_variant_id}
                            </p>
                          )}
                          {item.condition_on_receipt && (
                            <p className="text-gray-400 font-medium">
                              Condition on receipt: <span className="text-white font-bold bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded font-mono text-[9px]">{item.condition_on_receipt}</span>
                            </p>
                          )}
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <span className="font-bold text-white">Qty: {item.quantity}</span>
                          
                          {/* receipt condition input (Only shown when returnTransitionStatus is RECEIVED_IN_STORE or COMPLETED) */}
                          {['RECEIVED_IN_STORE', 'COMPLETED'].includes(returnTransitionStatus) && (
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[10px] text-gray-505 font-bold uppercase">Condition:</span>
                              <select
                                value={returnItemsConditions[item.id] || 'RESELLABLE'}
                                onChange={(e) => setReturnItemsConditions(prev => ({ ...prev, [item.id]: e.target.value }))}
                                className="bg-gray-900 border border-gray-800 text-[10px] text-white p-1 rounded font-bold"
                              >
                                <option value="RESELLABLE">Resellable</option>
                                <option value="DAMAGED">Damaged</option>
                                <option value="DEFECTIVE">Defective</option>
                              </select>
                            </div>
                          )}

                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer Comment */}
                {selectedReturn.customer_comment && (
                  <div className="bg-gray-955 border border-gray-855 p-4 rounded-xl text-xs space-y-1">
                    <h4 className="font-bold text-gray-405 uppercase tracking-wider">Customer Comment</h4>
                    <p className="text-gray-305 italic">"{selectedReturn.customer_comment}"</p>
                  </div>
                )}

              </div>

              {/* Right column: Return status transition control */}
              <div className="space-y-4">
                
                {getValidReturnStatusTransitions(selectedReturn.status).length > 0 && (
                  <form onSubmit={handleUpdateReturnStatus} className="bg-gray-955 border border-gray-855 p-4 rounded-xl space-y-4">
                    <h4 className="font-bold text-white border-b border-gray-855 pb-2">Transition Return Status</h4>
                    
                    {/* Status select dropdown */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-505 font-bold uppercase block">Next Status *</label>
                      <select
                        required
                        value={returnTransitionStatus}
                        onChange={(e) => setReturnTransitionStatus(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                      >
                        <option value="">-- Choose Status --</option>
                        {getValidReturnStatusTransitions(selectedReturn.status).map(target => (
                          <option key={target} value={target}>{target.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>

                    {/* Transition comments */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-505 font-bold uppercase block">Review Comment</label>
                      <textarea
                        rows={3}
                        value={returnComment}
                        onChange={(e) => setReturnComment(e.target.value)}
                        placeholder="E.g., Pickup scheduled with delivery partner, or items checked..."
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-white placeholder-gray-750 focus:outline-none focus:border-amber-500 font-medium"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={updatingReturnStatus || !returnTransitionStatus}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-800 text-black font-extrabold rounded-lg text-xs transition-colors flex items-center justify-center space-x-1.5"
                    >
                      {updatingReturnStatus && <div className="animate-spin rounded-full h-3 w-3 border-t border-black mr-1" />}
                      <span>Apply Transition</span>
                    </button>
                  </form>
                )}

              </div>

            </div>

          </div>
        </div>
      )}

    </BaseLayout>
  );
}
