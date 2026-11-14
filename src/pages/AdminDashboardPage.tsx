import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Lock,
  LogOut,
  Package,
  Plus,
  Settings,
  Trash2,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { api } from '../lib/api';
import { AdminProductEditor } from '../components/admin/AdminProductEditor';
import { formatPaiseToINR, getPrimaryProductImage, getTotalProductStock } from '../utils/commerce';
import type { DashboardOverview, Order, OrderStatus, Product, StoreSettings } from '../types/ecommerce';

const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Paid',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
  'Refunded',
];

export function AdminDashboardPage() {
  const { user, authLoading, setAuthSession, logout, categories, navigate, refreshCatalog, showToast } =
    useStore();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [activeSection, setActiveSection] = useState<
    'overview' | 'products' | 'inventory' | 'orders' | 'settings'
  >('overview');

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [integrationInfo, setIntegrationInfo] = useState<{
    supabaseConfigured: boolean;
    persistenceMode: string;
    razorpayConfigured: boolean;
  }>({ supabaseConfigured: false, persistenceMode: 'local_json_relational_store', razorpayConfigured: false });

  const [adminProducts, setAdminProducts] = useState<Product[]>([]);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [settingsForm, setSettingsForm] = useState<StoreSettings | null>(null);

  const [productSearch, setProductSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null | undefined>(undefined);

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | OrderStatus>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusUpdateForm, setStatusUpdateForm] = useState<{
    orderStatus: OrderStatus;
    trackingNumber: string;
    carrierName: string;
    note: string;
  }>({ orderStatus: 'Processing', trackingNumber: '', carrierName: '', note: '' });

  const [stockDrafts, setStockDrafts] = useState<Record<string, number>>({});

  const loadAdminData = useCallback(async () => {
    try {
      const [ovRes, prodRes, ordRes, cfgRes] = await Promise.all([
        api.adminGetOverview(),
        api.adminGetProducts(),
        api.adminGetOrders(),
        api.getStoreConfig(),
      ]);
      setOverview(ovRes.overview);
      setIntegrationInfo({
        supabaseConfigured: ovRes.integration.supabaseConfigured,
        persistenceMode: ovRes.integration.persistenceMode,
        razorpayConfigured: ovRes.razorpay.configured,
      });
      setAdminProducts(prodRes.products);
      setAdminOrders(ordRes.orders);
      setSettingsForm(cfgRes.settings);

      const drafts: Record<string, number> = {};
      for (const p of prodRes.products) {
        for (const v of p.variants) {
          drafts[v.id] = v.stockQuantity;
        }
      }
      setStockDrafts(drafts);
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  }, [showToast]);

  useEffect(() => {
    if (user?.role === 'admin') {
      void loadAdminData();
    }
  }, [user, loadAdminData]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginBusy(true);
    try {
      const res = await api.login(loginEmail, loginPassword);
      if (res.user.role !== 'admin') {
        setLoginError('This account does not have administrator privileges.');
        return;
      }
      setAuthSession(res.user, res.token);
      showToast('Signed in to Store Admin.', 'success');
    } catch (err) {
      setLoginError((err as Error).message);
    } finally {
      setLoginBusy(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return adminProducts;
    return adminProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q)
    );
  }, [adminProducts, productSearch]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return adminOrders.filter((o) => {
      if (orderStatusFilter !== 'all' && o.orderStatus !== orderStatusFilter) return false;
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q)
      );
    });
  }, [adminOrders, orderSearch, orderStatusFilter]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Unauthenticated or Non-Admin Gate
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-neutral-200 p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-neutral-900">
              <Lock className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Protected Console</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-xs text-neutral-500 hover:text-neutral-900 inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Storefront
            </button>
          </div>

          {user && user.role !== 'admin' ? (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold text-neutral-900">Access Denied</h1>
              <p className="text-sm text-neutral-600">
                Signed in as <strong>{user.email}</strong> (Customer). Administrator privileges are required to operate the store dashboard.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={logout}
                  className="px-4 py-2.5 bg-neutral-900 text-white text-xs font-medium"
                >
                  Sign Out & Switch Account
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="px-4 py-2.5 border border-neutral-300 text-xs font-medium"
                >
                  Back to Shop
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <h1 className="font-editorial text-3xl font-medium text-neutral-900">
                  Atelier Vanya Admin
                </h1>
                <p className="text-xs text-neutral-500 mt-1">
                  Sign in with your administrator credentials to manage catalog, inventory, orders, and store settings.
                </p>
              </div>

              {loginError && (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 text-xs text-red-800">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label htmlFor="adm-email" className="block text-xs font-medium text-neutral-700 mb-1">
                    Admin Email
                  </label>
                  <input
                    id="adm-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full border border-neutral-300 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="adm-pass" className="block text-xs font-medium text-neutral-700 mb-1">
                    Password
                  </label>
                  <input
                    id="adm-pass"
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full border border-neutral-300 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loginBusy}
                  className="w-full py-3 bg-neutral-900 text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 disabled:opacity-50"
                >
                  {loginBusy ? 'Verifying...' : 'Sign In to Dashboard'}
                </button>
              </form>

              <div className="pt-4 border-t border-neutral-200 text-xs text-neutral-500 space-y-1">
                <p>Demo Store Owner Account:</p>
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail('admin@ateliervanya.com');
                    setLoginPassword('VanyaAdmin123!');
                  }}
                  className="underline text-neutral-900 hover:opacity-70"
                >
                  Fill Demo Admin Credentials
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const handleTogglePublish = async (p: Product) => {
    try {
      await api.adminTogglePublish(p.id, !p.isPublished);
      await loadAdminData();
      await refreshCatalog();
      showToast(p.isPublished ? 'Product unpublished.' : 'Product published.', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleDeleteProduct = async (p: Product) => {
    try {
      await api.adminDeleteProduct(p.id);
      await loadAdminData();
      await refreshCatalog();
      showToast('Product deleted.', 'info');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleSaveStock = async (variantId: string) => {
    try {
      await api.adminUpdateStock(variantId, stockDrafts[variantId] ?? 0);
      await loadAdminData();
      await refreshCatalog();
      showToast('Inventory updated.', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleUpdateOrderStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      const res = await api.adminUpdateOrderStatus(selectedOrder.id, statusUpdateForm);
      setSelectedOrder(res.order);
      await loadAdminData();
      showToast(`Order ${res.order.orderNumber} updated to ${res.order.orderStatus}.`, 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm) return;
    try {
      await api.adminUpdateSettings(settingsForm);
      await refreshCatalog();
      showToast('Store settings saved.', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'orders', label: 'Orders', icon: ClipboardList },
    { id: 'settings', label: 'Store Settings', icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-neutral-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <span className="font-editorial text-xl font-semibold">Atelier Vanya</span>
            <p className="text-[11px] text-neutral-500">Store Operations</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-xs text-neutral-600 hover:text-neutral-900 underline"
          >
            Storefront
          </button>
        </div>

        <nav aria-label="Admin navigation" className="flex md:flex-col overflow-x-auto p-3 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-neutral-200 hidden md:flex items-center justify-between text-xs">
          <span className="truncate text-neutral-600">{user.email}</span>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out of admin"
            className="p-1.5 text-neutral-500 hover:text-neutral-900"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-5 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-200">
          <div>
            <p className="text-xs text-neutral-500">
              Admin / <span className="capitalize text-neutral-900 font-medium">{activeSection}</span>
            </p>
            <h1 className="text-2xl font-semibold text-neutral-900 capitalize mt-0.5">
              {activeSection === 'settings' ? 'Store Settings' : activeSection}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditingProduct(null)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Add Product
            </button>
          </div>
        </div>

        {/* OVERVIEW */}
        {activeSection === 'overview' && overview && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              {[
                { label: 'Total Revenue', value: formatPaiseToINR(overview.totalRevenuePaise) },
                { label: 'Total Orders', value: overview.totalOrders },
                { label: 'Pending Orders', value: overview.pendingOrders },
                { label: 'Completed', value: overview.completedOrders },
                { label: 'Products', value: overview.totalProducts },
                { label: 'Customers', value: overview.totalCustomers },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white border border-neutral-200 p-4">
                  <p className="text-xs text-neutral-500">{kpi.label}</p>
                  <p className="text-xl font-semibold text-neutral-900 mt-1 tabular-nums">{kpi.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <section className="lg:col-span-7 bg-white border border-neutral-200">
                <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Recent Orders</h2>
                  <button
                    type="button"
                    onClick={() => setActiveSection('orders')}
                    className="text-xs text-neutral-600 hover:text-neutral-900 underline"
                  >
                    View all
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500">
                      <tr>
                        <th className="py-2.5 px-4 font-medium">Order</th>
                        <th className="py-2.5 px-4 font-medium">Customer</th>
                        <th className="py-2.5 px-4 font-medium">Order Status</th>
                        <th className="py-2.5 px-4 font-medium">Payment</th>
                        <th className="py-2.5 px-4 font-medium text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {overview.recentOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-neutral-50">
                          <td className="py-2.5 px-4 font-mono font-medium">{o.orderNumber}</td>
                          <td className="py-2.5 px-4">{o.customerName}</td>
                          <td className="py-2.5 px-4 font-medium">{o.orderStatus}</td>
                          <td className="py-2.5 px-4 capitalize text-neutral-600">{o.paymentStatus}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-medium">
                            {formatPaiseToINR(o.totalPaise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="lg:col-span-5 bg-white border border-neutral-200">
                <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Low-Stock Alerts
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveSection('inventory')}
                    className="text-xs text-neutral-600 hover:text-neutral-900 underline"
                  >
                    Manage stock
                  </button>
                </div>
                <div className="divide-y divide-neutral-200">
                  {overview.lowStockItems.length === 0 ? (
                    <p className="p-5 text-xs text-neutral-500">All variants are above threshold.</p>
                  ) : (
                    overview.lowStockItems.map((item) => (
                      <div key={item.variantId} className="px-5 py-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-medium text-neutral-900">{item.productName}</p>
                          <p className="text-neutral-500 font-mono">
                            {item.variantSku} · {item.size} / {item.colorName}
                          </p>
                        </div>
                        <span
                          className={`font-semibold tabular-nums ${
                            item.stockQuantity === 0 ? 'text-red-700' : 'text-amber-700'
                          }`}
                        >
                          {item.stockQuantity === 0 ? 'Out of stock' : `${item.stockQuantity} left`}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* PRODUCTS */}
        {activeSection === 'products' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products by name, SKU, or category..."
                className="w-full max-w-sm bg-white border border-neutral-300 px-3.5 py-2 text-xs"
              />
            </div>

            <div className="bg-white border border-neutral-200 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500">
                  <tr>
                    <th className="py-3 px-4 font-medium">Product</th>
                    <th className="py-3 px-4 font-medium">SKU</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium text-right">Price</th>
                    <th className="py-3 px-4 font-medium text-right">Stock</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredProducts.map((p) => {
                    const img = getPrimaryProductImage(p);
                    const totalStock = getTotalProductStock(p);
                    return (
                      <tr key={p.id} className="hover:bg-neutral-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-12 bg-neutral-100 shrink-0 overflow-hidden">
                              {img && (
                                <img
                                  src={img}
                                  alt={p.name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <span className="font-medium text-neutral-900">{p.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-neutral-600">{p.sku}</td>
                        <td className="py-3 px-4">{p.categoryName}</td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {formatPaiseToINR(p.sellingPricePaise)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">{totalStock}</td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleTogglePublish(p)}
                            className={`underline font-medium ${
                              p.isPublished ? 'text-emerald-700' : 'text-neutral-500'
                            }`}
                          >
                            {p.isPublished ? 'Published' : 'Unpublished'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right space-x-3">
                          <button
                            type="button"
                            onClick={() => setEditingProduct(p)}
                            className="text-neutral-900 font-medium underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            aria-label={`Delete ${p.name}`}
                            className="text-red-600 hover:text-red-800 inline-flex items-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* INVENTORY */}
        {activeSection === 'inventory' && (
          <div className="bg-white border border-neutral-200 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500">
                <tr>
                  <th className="py-3 px-4 font-medium">Product</th>
                  <th className="py-3 px-4 font-medium">Variant SKU</th>
                  <th className="py-3 px-4 font-medium">Size / Colour</th>
                  <th className="py-3 px-4 font-medium">Indicator</th>
                  <th className="py-3 px-4 font-medium text-right">Stock Qty</th>
                  <th className="py-3 px-4 font-medium text-right">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {adminProducts.flatMap((p) =>
                  p.variants.map((v) => (
                    <tr key={v.id} className="hover:bg-neutral-50">
                      <td className="py-2.5 px-4 font-medium">{p.name}</td>
                      <td className="py-2.5 px-4 font-mono text-neutral-600">{v.variantSku}</td>
                      <td className="py-2.5 px-4">
                        {v.size} · {v.colorName}
                      </td>
                      <td className="py-2.5 px-4">
                        {v.stockQuantity === 0 ? (
                          <span className="text-red-700 font-medium">Out of Stock</span>
                        ) : v.stockQuantity <= v.lowStockThreshold ? (
                          <span className="text-amber-700 font-medium">Low Stock</span>
                        ) : (
                          <span className="text-emerald-700">Healthy</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <input
                          type="number"
                          min={0}
                          aria-label={`Stock for ${v.variantSku}`}
                          value={stockDrafts[v.id] ?? v.stockQuantity}
                          onChange={(e) =>
                            setStockDrafts((prev) => ({
                              ...prev,
                              [v.id]: Number(e.target.value),
                            }))
                          }
                          className="w-20 border border-neutral-300 px-2 py-1 text-right tabular-nums"
                        />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleSaveStock(v.id)}
                          className="px-3 py-1 bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800"
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ORDERS */}
        {activeSection === 'orders' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap gap-3">
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search order #, customer, or email..."
                  className="flex-1 min-w-[200px] bg-white border border-neutral-300 px-3 py-2 text-xs"
                />
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value as 'all' | OrderStatus)}
                  aria-label="Filter orders by status"
                  className="bg-white border border-neutral-300 px-3 py-2 text-xs"
                >
                  <option value="all">All Statuses</option>
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-white border border-neutral-200 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500">
                    <tr>
                      <th className="py-3 px-4 font-medium">Order</th>
                      <th className="py-3 px-4 font-medium">Customer</th>
                      <th className="py-3 px-4 font-medium">Payment</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredOrders.map((o) => (
                      <tr
                        key={o.id}
                        onClick={() => {
                          setSelectedOrder(o);
                          setStatusUpdateForm({
                            orderStatus: o.orderStatus,
                            trackingNumber: o.trackingNumber,
                            carrierName: o.carrierName,
                            note: '',
                          });
                        }}
                        className={`cursor-pointer hover:bg-neutral-50 ${
                          selectedOrder?.id === o.id ? 'bg-neutral-100' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-medium">{o.orderNumber}</td>
                        <td className="py-3 px-4">{o.customerName}</td>
                        <td className="py-3 px-4 capitalize">
                          {o.paymentMethod} · {o.paymentStatus}
                        </td>
                        <td className="py-3 px-4 font-medium">{o.orderStatus}</td>
                        <td className="py-3 px-4 text-right tabular-nums font-medium">
                          {formatPaiseToINR(o.totalPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-5 bg-white border border-neutral-200 p-5 h-fit">
              {!selectedOrder ? (
                <p className="text-xs text-neutral-500 py-10 text-center">
                  Select an order row to inspect fulfillment details and update status.
                </p>
              ) : (
                <div className="space-y-5">
                  <div className="pb-3 border-b border-neutral-200">
                    <p className="font-mono text-sm font-semibold">{selectedOrder.orderNumber}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {selectedOrder.customerName} · {selectedOrder.customerEmail} · {selectedOrder.customerPhone}
                    </p>
                    <p className="text-xs text-neutral-600 mt-1">
                      {selectedOrder.shippingAddress}, {selectedOrder.shippingCity}, {selectedOrder.shippingState} — {selectedOrder.shippingPinCode}
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <p className="font-semibold text-neutral-900">Items</p>
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="flex justify-between">
                        <span>
                          {item.productName} ({item.size}, {item.colorName}) × {item.quantity}
                        </span>
                        <span className="tabular-nums font-medium">
                          {formatPaiseToINR(item.lineTotalPaise)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleUpdateOrderStatus} className="space-y-3 pt-3 border-t border-neutral-200">
                    <div>
                      <label htmlFor="ord-status" className="block text-xs font-medium mb-1">
                        Order Status
                      </label>
                      <select
                        id="ord-status"
                        value={statusUpdateForm.orderStatus}
                        onChange={(e) =>
                          setStatusUpdateForm((prev) => ({
                            ...prev,
                            orderStatus: e.target.value as OrderStatus,
                          }))
                        }
                        className="w-full border border-neutral-300 px-3 py-2 text-xs bg-white"
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Carrier (e.g. Blue Dart)"
                        value={statusUpdateForm.carrierName}
                        onChange={(e) =>
                          setStatusUpdateForm((prev) => ({ ...prev, carrierName: e.target.value }))
                        }
                        className="border border-neutral-300 px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Tracking Number"
                        value={statusUpdateForm.trackingNumber}
                        onChange={(e) =>
                          setStatusUpdateForm((prev) => ({ ...prev, trackingNumber: e.target.value }))
                        }
                        className="border border-neutral-300 px-3 py-2 text-xs font-mono"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Status history note (optional)"
                      value={statusUpdateForm.note}
                      onChange={(e) =>
                        setStatusUpdateForm((prev) => ({ ...prev, note: e.target.value }))
                      }
                      className="w-full border border-neutral-300 px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800"
                    >
                      Update Order Status
                    </button>
                  </form>

                  <div className="pt-3 border-t border-neutral-200 space-y-2">
                    <p className="text-xs font-semibold">Status History</p>
                    {selectedOrder.statusHistory.map((h) => (
                      <div key={h.id} className="text-xs text-neutral-600 flex justify-between gap-2">
                        <span>
                          <strong className="text-neutral-900">{h.status}:</strong> {h.note}
                        </span>
                        <span className="shrink-0 tabular-nums text-neutral-400">
                          {new Date(h.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {activeSection === 'settings' && settingsForm && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleSaveSettings} className="lg:col-span-8 bg-white border border-neutral-200 p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="set-name" className="block text-xs font-medium mb-1">
                    Store Name
                  </label>
                  <input
                    id="set-name"
                    type="text"
                    value={settingsForm.storeName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, storeName: e.target.value })}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="set-email" className="block text-xs font-medium mb-1">
                    Contact Email
                  </label>
                  <input
                    id="set-email"
                    type="email"
                    value={settingsForm.contactEmail}
                    onChange={(e) => setSettingsForm({ ...settingsForm, contactEmail: e.target.value })}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="set-phone" className="block text-xs font-medium mb-1">
                    Contact Phone
                  </label>
                  <input
                    id="set-phone"
                    type="text"
                    value={settingsForm.contactPhone}
                    onChange={(e) => setSettingsForm({ ...settingsForm, contactPhone: e.target.value })}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="set-logo" className="block text-xs font-medium mb-1">
                    Logo URL (optional)
                  </label>
                  <input
                    id="set-logo"
                    type="text"
                    value={settingsForm.logoUrl}
                    onChange={(e) => setSettingsForm({ ...settingsForm, logoUrl: e.target.value })}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="set-addr" className="block text-xs font-medium mb-1">
                  Atelier Address
                </label>
                <input
                  id="set-addr"
                  type="text"
                  value={settingsForm.address}
                  onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                  className="w-full border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="set-ann" className="block text-xs font-medium mb-1">
                  Top Announcement Banner
                </label>
                <input
                  id="set-ann"
                  type="text"
                  value={settingsForm.announcementText}
                  onChange={(e) => setSettingsForm({ ...settingsForm, announcementText: e.target.value })}
                  className="w-full border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="set-hero-title" className="block text-xs font-medium mb-1">
                  Homepage Hero Headline
                </label>
                <input
                  id="set-hero-title"
                  type="text"
                  value={settingsForm.heroTitle}
                  onChange={(e) => setSettingsForm({ ...settingsForm, heroTitle: e.target.value })}
                  className="w-full border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="set-hero-sub" className="block text-xs font-medium mb-1">
                  Homepage Hero Subtitle
                </label>
                <textarea
                  id="set-hero-sub"
                  rows={2}
                  value={settingsForm.heroSubtitle}
                  onChange={(e) => setSettingsForm({ ...settingsForm, heroSubtitle: e.target.value })}
                  className="w-full border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="set-ship" className="block text-xs font-medium mb-1">
                    Shipping Fee (INR)
                  </label>
                  <input
                    id="set-ship"
                    type="number"
                    min={0}
                    value={settingsForm.shippingFeePaise / 100}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        shippingFeePaise: Math.round(Number(e.target.value) * 100),
                      })
                    }
                    className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="set-free" className="block text-xs font-medium mb-1">
                    Free Shipping Threshold (INR)
                  </label>
                  <input
                    id="set-free"
                    type="number"
                    min={0}
                    value={settingsForm.freeShippingThresholdPaise / 100}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        freeShippingThresholdPaise: Math.round(Number(e.target.value) * 100),
                      })
                    }
                    className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={settingsForm.codEnabled}
                  onChange={(e) => setSettingsForm({ ...settingsForm, codEnabled: e.target.checked })}
                  className="accent-neutral-900"
                />
                Enable Cash on Delivery (COD)
              </label>

              <button
                type="submit"
                className="px-6 py-2.5 bg-neutral-900 text-white text-xs font-semibold uppercase tracking-wider"
              >
                Save Store Settings
              </button>
            </form>

            <aside className="lg:col-span-4 bg-white border border-neutral-200 p-6 space-y-4 h-fit">
              <h2 className="text-sm font-semibold">Environment & Gateway Status</h2>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-neutral-50 border border-neutral-200">
                  <p className="font-medium text-neutral-900">Database & Storage</p>
                  <p className="text-neutral-600 mt-1">
                    {integrationInfo.supabaseConfigured
                      ? 'Connected to Supabase PostgreSQL & Storage.'
                      : 'Running on local persistent store (data/store-db.json). Add SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY in .env to switch to Supabase.'}
                  </p>
                </div>
                <div className="p-3 bg-neutral-50 border border-neutral-200">
                  <p className="font-medium text-neutral-900">Razorpay Gateway</p>
                  <p className="text-neutral-600 mt-1">
                    {integrationInfo.razorpayConfigured
                      ? 'Razorpay API keys configured.'
                      : 'Running in HMAC Test-Mode simulation. Add RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET & RAZORPAY_WEBHOOK_SECRET in .env for live Razorpay Checkout.'}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      {editingProduct !== undefined && (
        <AdminProductEditor
          product={editingProduct}
          categories={categories}
          onClose={() => setEditingProduct(undefined)}
          onSaved={async () => {
            await loadAdminData();
            await refreshCatalog();
            showToast('Product catalog updated.', 'success');
          }}
        />
      )}
    </div>
  );
}
