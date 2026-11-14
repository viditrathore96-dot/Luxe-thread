import type {
  Address,
  Category,
  Coupon,
  DashboardOverview,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductReview,
  Profile,
  StoreSettings,
} from '../types/ecommerce';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('av_auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`) as Error & {
      status?: number;
      errors?: Record<string, string>;
    };
    err.status = res.status;
    err.errors = data.errors;
    throw err;
  }
  return data as T;
}

export const api = {
  getStoreConfig: () =>
    request<{
      settings: StoreSettings;
      categories: Category[];
      razorpay: { configured: boolean; keyId: string | null; mode: string };
      integration: { supabaseConfigured: boolean; persistenceMode: string };
    }>('/api/store/config'),

  getProducts: () => request<{ products: Product[] }>('/api/products'),
  getProductBySlug: (slug: string) => request<{ product: Product }>(`/api/products/${encodeURIComponent(slug)}`),

  addReview: (productId: string, payload: { rating: number; comment: string }) =>
    request<{ review: ProductReview }>(`/api/products/${productId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  subscribeNewsletter: (email: string) =>
    request<{ subscribed: boolean; alreadySubscribed: boolean }>('/api/newsletter', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  validateCoupon: (code: string, subtotalPaise: number) =>
    request<{ coupon: Coupon }>('/api/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code, subtotalPaise }),
    }),

  // Auth
  getMe: () => request<{ user: Profile | null }>('/api/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: Profile; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (payload: { email: string; password: string; fullName: string; phone?: string }) =>
    request<{ user: Profile; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  // Account
  updateProfile: (payload: { fullName: string; phone: string }) =>
    request<{ user: Profile }>('/api/account/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getAddresses: () => request<{ addresses: Address[] }>('/api/account/addresses'),
  addAddress: (payload: Omit<Address, 'id' | 'userId'>) =>
    request<{ address: Address }>('/api/account/addresses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteAddress: (id: string) =>
    request<{ ok: boolean }>(`/api/account/addresses/${id}`, { method: 'DELETE' }),
  getMyOrders: () => request<{ orders: Order[] }>('/api/account/orders'),
  getWishlist: () => request<{ productIds: string[] }>('/api/account/wishlist'),
  toggleWishlist: (productId: string) =>
    request<{ productIds: string[] }>('/api/account/wishlist/toggle', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    }),
  getOrderById: (id: string) => request<{ order: Order }>(`/api/orders/${id}`),

  // Checkout & Razorpay
  createCheckoutOrder: (payload: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    shippingAddress: string;
    shippingCity: string;
    shippingState: string;
    shippingPinCode: string;
    paymentMethod: PaymentMethod;
    couponCode?: string;
    items: Array<{ productId: string; variantId: string; quantity: number }>;
  }) =>
    request<{
      order: Order;
      razorpayOrder: { id: string; amount: number; currency: string; mode: string } | null;
      razorpayKeyId?: string | null;
    }>('/api/checkout/create-order', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyRazorpayPayment: (payload: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature?: string;
    simulateTestSignature?: boolean;
    paymentMethodLabel?: string;
  }) =>
    request<{ verified: boolean; alreadyProcessed: boolean; order: Order }>('/api/payments/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  failRazorpayPayment: (orderId: string, reason: string) =>
    request<{ order: Order }>('/api/payments/fail', {
      method: 'POST',
      body: JSON.stringify({ orderId, reason }),
    }),

  // Admin
  adminGetOverview: () =>
    request<{
      overview: DashboardOverview;
      integration: { supabaseConfigured: boolean; persistenceMode: string };
      razorpay: { configured: boolean; keyId: string | null; webhookConfigured: boolean; mode: string };
    }>('/api/admin/overview'),
  adminGetProducts: () => request<{ products: Product[] }>('/api/admin/products'),
  adminCreateProduct: (payload: Record<string, unknown>) =>
    request<{ product: Product }>('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminUpdateProduct: (id: string, payload: Record<string, unknown>) =>
    request<{ product: Product }>(`/api/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  adminTogglePublish: (id: string, isPublished: boolean) =>
    request<{ product: Product }>(`/api/admin/products/${id}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublished }),
    }),
  adminDeleteProduct: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/products/${id}`, { method: 'DELETE' }),
  adminUploadImage: (payload: { fileName: string; mimeType: string; base64Data: string }) =>
    request<{ imageUrl: string; storageMode: string }>('/api/admin/upload', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminUpdateStock: (variantId: string, stockQuantity: number) =>
    request<{ variant: { id: string; stockQuantity: number } }>(`/api/admin/inventory/${variantId}`, {
      method: 'PATCH',
      body: JSON.stringify({ stockQuantity }),
    }),
  adminGetOrders: () => request<{ orders: Order[] }>('/api/admin/orders'),
  adminUpdateOrderStatus: (
    orderId: string,
    payload: { orderStatus: OrderStatus; trackingNumber?: string; carrierName?: string; note?: string }
  ) =>
    request<{ order: Order }>(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  adminUpdateSettings: (payload: Partial<StoreSettings>) =>
    request<{ settings: StoreSettings }>('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};
