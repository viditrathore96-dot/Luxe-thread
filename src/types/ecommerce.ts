export type UserRole = 'customer' | 'admin';

export type OrderStatus =
  | 'Pending'
  | 'Paid'
  | 'Processing'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled'
  | 'Refunded';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type PaymentMethod = 'razorpay' | 'cod';

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  displayOrder: number;
}

export interface ProductImage {
  id: string;
  productId: string;
  imageUrl: string;
  altText: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  size: string;
  colorName: string;
  colorHex: string;
  variantSku: string;
  stockQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
}

export interface ProductReview {
  id: string;
  productId: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Product {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  name: string;
  slug: string;
  brand: string;
  description: string;
  fabricCare: string;
  sku: string;
  originalPricePaise: number;
  sellingPricePaise: number;
  isPublished: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  popularityScore: number;
  images: ProductImage[];
  variants: ProductVariant[];
  reviews?: ProductReview[];
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  productId: string;
  variantId: string;
  productName: string;
  slug: string;
  brand: string;
  sku: string;
  size: string;
  colorName: string;
  colorHex: string;
  imageUrl: string;
  originalPricePaise: number;
  sellingPricePaise: number;
  quantity: number;
  maxStock: number;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  recipientName: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  pinCode: string;
  isDefault: boolean;
}

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  brand: string;
  sku: string;
  size: string;
  colorName: string;
  imageUrl: string;
  unitPricePaise: number;
  quantity: number;
  lineTotalPaise: number;
}

export interface OrderStatusHistoryEntry {
  id: string;
  status: OrderStatus;
  note: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  gateway: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  amountPaise: number;
  currency: string;
  method?: string;
  status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';
  failureReason?: string;
  verifiedAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPinCode: string;
  subtotalPaise: number;
  discountPaise: number;
  couponCode?: string | null;
  shippingPaise: number;
  totalPaise: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  trackingNumber: string;
  carrierName: string;
  inventoryDeducted: boolean;
  items: OrderItem[];
  payment?: PaymentRecord | null;
  statusHistory: OrderStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface StoreSettings {
  storeName: string;
  logoUrl: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  instagramUrl: string;
  pinterestUrl: string;
  announcementText: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaLabel: string;
  heroImageUrl: string;
  shippingFeePaise: number;
  freeShippingThresholdPaise: number;
  codEnabled: boolean;
}

export interface Coupon {
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderPaise: number;
  isActive: boolean;
}

export interface DashboardOverview {
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenuePaise: number;
  recentOrders: Order[];
  lowStockItems: Array<{
    productId: string;
    productName: string;
    variantId: string;
    variantSku: string;
    size: string;
    colorName: string;
    stockQuantity: number;
    lowStockThreshold: number;
  }>;
}
