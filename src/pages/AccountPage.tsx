import React, { useEffect, useState } from 'react';
import { LogOut, MapPin, Package, Plus, Trash2, User } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { api } from '../lib/api';
import { ProductCard } from '../components/ProductCard';
import { formatPaiseToINR } from '../utils/commerce';
import type { Address, Order } from '../types/ecommerce';

export function AccountPage() {
  const { user, authLoading, setAuthSession, logout, products, wishlistIds, navigate, showToast } =
    useStore();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [activeTab, setActiveTab] = useState<'orders' | 'addresses' | 'profile' | 'wishlist'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);

  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');

  const [newAddress, setNewAddress] = useState({
    label: 'Home',
    recipientName: '',
    phone: '',
    streetAddress: '',
    city: '',
    state: '',
    pinCode: '',
    isDefault: true,
  });

  useEffect(() => {
    if (user) {
      setProfileName(user.fullName);
      setProfilePhone(user.phone);
      Promise.all([api.getMyOrders(), api.getAddresses()])
        .then(([ordRes, addrRes]) => {
          setOrders(ordRes.orders);
          setAddresses(addrRes.addresses);
        })
        .catch(() => {});
    }
  }, [user]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthBusy(true);
    try {
      if (authMode === 'login') {
        const res = await api.login(email, password);
        setAuthSession(res.user, res.token);
        showToast(`Welcome back, ${res.user.fullName}.`, 'success');
      } else {
        const res = await api.register({ email, password, fullName, phone });
        setAuthSession(res.user, res.token);
        showToast('Account created.', 'success');
      }
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.updateProfile({ fullName: profileName, phone: profilePhone });
      setAuthSession(res.user);
      showToast('Profile updated.', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.addAddress(newAddress);
      setAddresses((prev) => [...prev, res.address]);
      setNewAddress({
        label: 'Home',
        recipientName: '',
        phone: '',
        streetAddress: '',
        city: '',
        state: '',
        pinCode: '',
        isDefault: false,
      });
      showToast('Delivery address saved.', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await api.deleteAddress(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  if (authLoading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="h-48 bg-[#EAE6DD] animate-pulse" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-md mx-auto px-4 py-16">
        <div className="bg-[#FAF9F6] border border-[#E5E1D8] p-8 space-y-6">
          <div>
            <p className="text-xs text-[#6B6860] uppercase tracking-wider mb-1">Client Portal</p>
            <h1 className="font-editorial text-3xl font-medium text-[#141413]">
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </h1>
          </div>

          <div className="grid grid-cols-2 border border-[#D8D3C8] p-1 bg-[#F3F0E8]">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setAuthError('');
              }}
              className={`py-2 text-xs font-medium ${
                authMode === 'login' ? 'bg-[#FAF9F6] text-[#141413]' : 'text-[#6B6860]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setAuthError('');
              }}
              className={`py-2 text-xs font-medium ${
                authMode === 'register' ? 'bg-[#FAF9F6] text-[#141413]' : 'text-[#6B6860]'
              }`}
            >
              Register
            </button>
          </div>

          {authError && (
            <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 p-3">
              {authError}
            </p>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'register' && (
              <>
                <div>
                  <label htmlFor="acc-name" className="block text-xs font-medium mb-1">
                    Full Name
                  </label>
                  <input
                    id="acc-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full border border-[#D8D3C8] px-3.5 py-2.5 text-sm bg-[#FAF9F6]"
                  />
                </div>
                <div>
                  <label htmlFor="acc-phone" className="block text-xs font-medium mb-1">
                    Mobile Number
                  </label>
                  <input
                    id="acc-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-[#D8D3C8] px-3.5 py-2.5 text-sm bg-[#FAF9F6]"
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="acc-email" className="block text-xs font-medium mb-1">
                Email Address
              </label>
              <input
                id="acc-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-[#D8D3C8] px-3.5 py-2.5 text-sm bg-[#FAF9F6]"
              />
            </div>

            <div>
              <label htmlFor="acc-password" className="block text-xs font-medium mb-1">
                Password
              </label>
              <input
                id="acc-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-[#D8D3C8] px-3.5 py-2.5 text-sm bg-[#FAF9F6]"
              />
            </div>

            <button
              type="submit"
              disabled={authBusy}
              className="w-full py-3 bg-[#141413] text-[#FAF9F6] text-xs font-semibold uppercase tracking-wider hover:bg-[#2C2B29] disabled:opacity-60"
            >
              {authBusy ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {authMode === 'login' && (
            <div className="pt-4 border-t border-[#EAE6DD] space-y-2 text-xs text-[#6B6860]">
              <p>Demo Customer Account:</p>
              <button
                type="button"
                onClick={() => {
                  setEmail('customer@ateliervanya.com');
                  setPassword('VanyaCustomer123!');
                }}
                className="underline text-[#141413] hover:opacity-70"
              >
                Fill Demo Customer Credentials
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  const wishlistedProducts = products.filter((p) => wishlistIds.includes(p.id));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="pb-8 border-b border-[#E5E1D8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-[#6B6860] uppercase tracking-wider mb-1">Client Account</p>
          <h1 className="font-editorial text-4xl font-medium text-[#141413]">{user.fullName}</h1>
          <p className="text-sm text-[#6B6860]">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          {user.role === 'admin' && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="px-4 py-2.5 bg-[#141413] text-[#FAF9F6] text-xs font-semibold uppercase tracking-wider"
            >
              Open Admin Dashboard
            </button>
          )}
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#D8D3C8] text-xs font-medium text-[#141413] hover:border-[#141413]"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 py-6 border-b border-[#EAE6DD]">
        {[
          { id: 'orders', label: `Orders (${orders.length})`, icon: Package },
          { id: 'addresses', label: `Addresses (${addresses.length})`, icon: MapPin },
          { id: 'wishlist', label: `Wishlist (${wishlistedProducts.length})`, icon: Plus },
          { id: 'profile', label: 'Profile', icon: User },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`px-4 py-2 text-xs font-medium border transition-colors ${
              activeTab === t.id
                ? 'bg-[#141413] text-[#FAF9F6] border-[#141413]'
                : 'border-[#D8D3C8] text-[#52504B] hover:border-[#141413]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-8">
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <p className="text-sm text-[#6B6860]">You have not placed any orders yet.</p>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className="border border-[#E5E1D8] bg-[#FAF9F6] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[#141413]">
                      {order.orderNumber} · {order.orderStatus}
                    </p>
                    <p className="text-xs text-[#6B6860]">
                      Placed {new Date(order.createdAt).toLocaleDateString()} · {order.items.length} item(s) · Payment: {order.paymentStatus}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatPaiseToINR(order.totalPaise)}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/order/${order.id}`)}
                      className="px-4 py-2 border border-[#141413] text-xs font-medium hover:bg-[#141413] hover:text-[#FAF9F6] transition-colors"
                    >
                      View & Track
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'addresses' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-6 space-y-4">
              <h2 className="font-editorial text-2xl text-[#141413]">Saved Addresses</h2>
              {addresses.map((addr) => (
                <div key={addr.id} className="border border-[#E5E1D8] p-4 flex justify-between gap-4">
                  <div className="text-sm space-y-1">
                    <p className="font-semibold text-[#141413]">
                      {addr.label} {addr.isDefault ? '(Default)' : ''}
                    </p>
                    <p>{addr.recipientName} · {addr.phone}</p>
                    <p className="text-[#52504B]">{addr.streetAddress}</p>
                    <p className="text-[#6B6860]">
                      {addr.city}, {addr.state} — {addr.pinCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteAddress(addr.id)}
                    aria-label={`Delete ${addr.label} address`}
                    className="text-[#88847C] hover:text-red-700 p-1 h-fit"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddAddress} className="lg:col-span-6 border border-[#E5E1D8] p-6 bg-[#F6F4EE] space-y-4">
              <h2 className="font-editorial text-2xl text-[#141413]">Add New Address</h2>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Label (Home / Studio)"
                  value={newAddress.label}
                  onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                  className="bg-[#FAF9F6] border border-[#D8D3C8] px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  required
                  placeholder="Recipient Name"
                  value={newAddress.recipientName}
                  onChange={(e) => setNewAddress({ ...newAddress, recipientName: e.target.value })}
                  className="bg-[#FAF9F6] border border-[#D8D3C8] px-3 py-2 text-sm"
                />
              </div>
              <input
                type="tel"
                required
                placeholder="Mobile Number"
                value={newAddress.phone}
                onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                className="w-full bg-[#FAF9F6] border border-[#D8D3C8] px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                placeholder="Street Address"
                value={newAddress.streetAddress}
                onChange={(e) => setNewAddress({ ...newAddress, streetAddress: e.target.value })}
                className="w-full bg-[#FAF9F6] border border-[#D8D3C8] px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="City"
                  value={newAddress.city}
                  onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                  className="bg-[#FAF9F6] border border-[#D8D3C8] px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  required
                  placeholder="State"
                  value={newAddress.state}
                  onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                  className="bg-[#FAF9F6] border border-[#D8D3C8] px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="PIN Code"
                  value={newAddress.pinCode}
                  onChange={(e) => setNewAddress({ ...newAddress, pinCode: e.target.value })}
                  className="bg-[#FAF9F6] border border-[#D8D3C8] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#141413] text-[#FAF9F6] text-xs font-semibold uppercase tracking-wider"
              >
                Save Address
              </button>
            </form>
          </div>
        )}

        {activeTab === 'wishlist' && (
          <div>
            {wishlistedProducts.length === 0 ? (
              <p className="text-sm text-[#6B6860]">No saved pieces in your wishlist yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {wishlistedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <form onSubmit={handleUpdateProfile} className="max-w-md space-y-4">
            <div>
              <label htmlFor="prof-name" className="block text-xs font-medium mb-1">
                Full Name
              </label>
              <input
                id="prof-name"
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full border border-[#D8D3C8] px-3.5 py-2.5 text-sm bg-[#FAF9F6]"
              />
            </div>
            <div>
              <label htmlFor="prof-phone" className="block text-xs font-medium mb-1">
                Phone Number
              </label>
              <input
                id="prof-phone"
                type="tel"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                className="w-full border border-[#D8D3C8] px-3.5 py-2.5 text-sm bg-[#FAF9F6]"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-[#141413] text-[#FAF9F6] text-xs font-semibold uppercase tracking-wider"
            >
              Save Changes
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
