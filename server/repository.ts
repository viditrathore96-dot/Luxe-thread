import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createInitialSeedDatabase, type StoreDatabase, type StoredUser } from './seedData';
import { hashPassword, verifyPassword } from './auth';
import { getSupabaseAdmin, isSupabaseConfigured } from './supabaseClient';
import type {
  Address,
  Category,
  Coupon,
  DashboardOverview,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductImage,
  ProductReview,
  ProductVariant,
  Profile,
  StoreSettings,
} from '../src/types/ecommerce';
import { calculateCartTotals, validateVariantAvailability } from '../src/utils/commerce';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'store-db.json');
const UPLOAD_DIR = path.resolve(process.cwd(), 'public', 'uploads');

function ensureStorageDirs(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

class StoreRepository {
  private db: StoreDatabase;

  constructor() {
    ensureStorageDirs();
    this.db = this.loadDatabase();
  }

  private loadDatabase(): StoreDatabase {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw) as StoreDatabase;
        if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.users)) {
          return parsed;
        }
      } catch {
        // Fall through to seed
      }
    }
    const seeded = createInitialSeedDatabase();
    this.saveDatabase(seeded);
    return seeded;
  }

  private saveDatabase(nextDb: StoreDatabase = this.db): void {
    ensureStorageDirs();
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(nextDb, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  }

  getIntegrationStatus() {
    return {
      supabaseConfigured: isSupabaseConfigured(),
      persistenceMode: isSupabaseConfigured() ? 'supabase_postgresql' : 'local_json_relational_store',
    };
  }

  // --- Auth & Profiles ---
  findUserByEmail(email: string): StoredUser | undefined {
    return this.db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  }

  findUserById(userId: string): StoredUser | undefined {
    return this.db.users.find((u) => u.id === userId);
  }

  toPublicProfile(user: StoredUser): Profile {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  registerCustomer(input: { email: string; password: string; fullName: string; phone?: string }): Profile {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (this.findUserByEmail(normalizedEmail)) {
      throw new Error('An account with this email already exists.');
    }
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const role = adminEmails.includes(normalizedEmail) ? 'admin' : 'customer';

    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      fullName: input.fullName.trim(),
      phone: (input.phone || '').trim(),
      role,
      passwordHash: hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };
    this.db.users.push(newUser);
    this.saveDatabase();
    return this.toPublicProfile(newUser);
  }

  authenticateUser(email: string, password: string): Profile | null {
    const user = this.findUserByEmail(email);
    if (!user) return null;
    if (!verifyPassword(password, user.passwordHash)) return null;
    return this.toPublicProfile(user);
  }

  updateProfile(userId: string, patch: { fullName: string; phone: string }): Profile {
    const user = this.findUserById(userId);
    if (!user) throw new Error('Account not found.');
    user.fullName = patch.fullName.trim();
    user.phone = patch.phone.trim();
    this.saveDatabase();
    return this.toPublicProfile(user);
  }

  // --- Addresses ---
  getUserAddresses(userId: string): Address[] {
    return this.db.addresses.filter((a) => a.userId === userId);
  }

  addAddress(userId: string, input: Omit<Address, 'id' | 'userId'>): Address {
    if (input.isDefault) {
      for (const a of this.db.addresses) {
        if (a.userId === userId) a.isDefault = false;
      }
    }
    const addr: Address = {
      ...input,
      id: crypto.randomUUID(),
      userId,
    };
    this.db.addresses.push(addr);
    this.saveDatabase();
    return addr;
  }

  deleteAddress(userId: string, addressId: string): boolean {
    const idx = this.db.addresses.findIndex((a) => a.id === addressId && a.userId === userId);
    if (idx === -1) return false;
    this.db.addresses.splice(idx, 1);
    this.saveDatabase();
    return true;
  }

  // --- Categories & Settings ---
  getCategories(): Category[] {
    return [...this.db.categories].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  getStoreSettings(): StoreSettings {
    return { ...this.db.storeSettings };
  }

  updateStoreSettings(patch: Partial<StoreSettings>): StoreSettings {
    this.db.storeSettings = {
      ...this.db.storeSettings,
      ...patch,
      shippingFeePaise: Math.max(0, Math.round(patch.shippingFeePaise ?? this.db.storeSettings.shippingFeePaise)),
      freeShippingThresholdPaise: Math.max(
        0,
        Math.round(patch.freeShippingThresholdPaise ?? this.db.storeSettings.freeShippingThresholdPaise)
      ),
    };
    this.saveDatabase();
    return this.getStoreSettings();
  }

  // --- Products & Variants ---
  getPublishedProducts(): Product[] {
    return this.db.products.filter((p) => p.isPublished);
  }

  getAllProductsAdmin(): Product[] {
    return [...this.db.products].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getProductBySlug(slug: string, includeUnpublished = false): Product | undefined {
    return this.db.products.find(
      (p) => p.slug === slug && (includeUnpublished || p.isPublished)
    );
  }

  getProductById(id: string): Product | undefined {
    return this.db.products.find((p) => p.id === id);
  }

  upsertProduct(input: {
    id?: string;
    categoryId: string;
    name: string;
    slug?: string;
    brand: string;
    description: string;
    fabricCare: string;
    sku: string;
    originalPricePaise: number;
    sellingPricePaise: number;
    isPublished: boolean;
    isFeatured: boolean;
    isNewArrival: boolean;
    images: Array<Omit<ProductImage, 'productId'>>;
    variants: Array<Omit<ProductVariant, 'productId'>>;
  }): Product {
    const category = this.db.categories.find((c) => c.id === input.categoryId);
    if (!category) throw new Error('Selected category does not exist.');

    const cleanSlug = (
      input.slug?.trim() ||
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
    ).slice(0, 80);

    const now = new Date().toISOString();
    const existingIdx = input.id ? this.db.products.findIndex((p) => p.id === input.id) : -1;
    const productId = existingIdx >= 0 ? this.db.products[existingIdx].id : crypto.randomUUID();

    // Ensure unique slug & sku across other products
    const slugConflict = this.db.products.find((p) => p.slug === cleanSlug && p.id !== productId);
    const finalSlug = slugConflict ? `${cleanSlug}-${productId.slice(0, 4)}` : cleanSlug;

    const skuConflict = this.db.products.find(
      (p) => p.sku.toLowerCase() === input.sku.trim().toLowerCase() && p.id !== productId
    );
    if (skuConflict) {
      throw new Error(`SKU "${input.sku}" is already assigned to another product.`);
    }

    const normalizedImages: ProductImage[] = input.images.map((img, index) => ({
      id: img.id || crypto.randomUUID(),
      productId,
      imageUrl: img.imageUrl,
      altText: img.altText || input.name,
      isPrimary: img.isPrimary,
      sortOrder: index,
    }));

    if (normalizedImages.length > 0 && !normalizedImages.some((i) => i.isPrimary)) {
      normalizedImages[0].isPrimary = true;
    }

    const normalizedVariants: ProductVariant[] = input.variants.map((v) => ({
      id: v.id || crypto.randomUUID(),
      productId,
      size: v.size.trim(),
      colorName: v.colorName.trim(),
      colorHex: v.colorHex || '#141413',
      variantSku: v.variantSku.trim() || `${input.sku.trim()}-${v.size.trim()}`,
      stockQuantity: Math.max(0, Math.floor(v.stockQuantity)),
      lowStockThreshold: Math.max(0, Math.floor(v.lowStockThreshold ?? 3)),
      isActive: v.isActive ?? true,
    }));

    if (normalizedVariants.length === 0) {
      throw new Error('At least one size/colour variant is required.');
    }

    const origPaise = Math.max(0, Math.round(input.originalPricePaise));
    const sellPaise = Math.min(origPaise, Math.max(0, Math.round(input.sellingPricePaise)));

    const product: Product = {
      id: productId,
      categoryId: category.id,
      categoryName: category.name,
      categorySlug: category.slug,
      name: input.name.trim(),
      slug: finalSlug,
      brand: input.brand.trim() || 'Atelier Vanya',
      description: input.description.trim(),
      fabricCare: input.fabricCare.trim(),
      sku: input.sku.trim(),
      originalPricePaise: origPaise,
      sellingPricePaise: sellPaise,
      isPublished: Boolean(input.isPublished),
      isFeatured: Boolean(input.isFeatured),
      isNewArrival: Boolean(input.isNewArrival),
      popularityScore: existingIdx >= 0 ? this.db.products[existingIdx].popularityScore : 80,
      images: normalizedImages,
      variants: normalizedVariants,
      reviews: existingIdx >= 0 ? this.db.products[existingIdx].reviews : [],
      createdAt: existingIdx >= 0 ? this.db.products[existingIdx].createdAt : now,
      updatedAt: now,
    };

    if (existingIdx >= 0) {
      this.db.products[existingIdx] = product;
    } else {
      this.db.products.unshift(product);
    }

    this.saveDatabase();
    return product;
  }

  toggleProductPublished(productId: string, isPublished: boolean): Product {
    const product = this.getProductById(productId);
    if (!product) throw new Error('Product not found.');
    product.isPublished = isPublished;
    product.updatedAt = new Date().toISOString();
    this.saveDatabase();
    return product;
  }

  deleteProduct(productId: string): boolean {
    const idx = this.db.products.findIndex((p) => p.id === productId);
    if (idx === -1) return false;
    this.db.products.splice(idx, 1);
    this.saveDatabase();
    return true;
  }

  updateVariantStock(variantId: string, stockQuantity: number): ProductVariant {
    const safeQty = Math.max(0, Math.floor(stockQuantity));
    for (const product of this.db.products) {
      const variant = product.variants.find((v) => v.id === variantId);
      if (variant) {
        variant.stockQuantity = safeQty;
        product.updatedAt = new Date().toISOString();
        this.saveDatabase();
        return variant;
      }
    }
    throw new Error('Variant not found.');
  }

  // --- Image Upload (Supabase Storage or validated local public/uploads) ---
  async uploadProductImage(params: {
    fileName: string;
    mimeType: string;
    base64Data: string;
  }): Promise<{ imageUrl: string; storageMode: 'supabase' | 'local' }> {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!allowedMimes.includes(params.mimeType)) {
      throw new Error('Invalid image type. Allowed formats: JPEG, PNG, WebP, AVIF.');
    }

    const cleanBase64 = params.base64Data.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
      throw new Error('Image size must be between 1 byte and 5 MB.');
    }

    const ext =
      params.mimeType === 'image/png'
        ? 'png'
        : params.mimeType === 'image/webp'
        ? 'webp'
        : params.mimeType === 'image/avif'
        ? 'avif'
        : 'jpg';
    const safeName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const storagePath = `catalog/${safeName}`;
      const { error } = await supabase.storage
        .from('product-images')
        .upload(storagePath, buffer, { contentType: params.mimeType, upsert: false });
      if (error) {
        throw new Error(`Supabase Storage upload failed: ${error.message}`);
      }
      const { data } = supabase.storage.from('product-images').getPublicUrl(storagePath);
      return { imageUrl: data.publicUrl, storageMode: 'supabase' };
    }

    ensureStorageDirs();
    const targetPath = path.join(UPLOAD_DIR, safeName);
    fs.writeFileSync(targetPath, buffer);
    return { imageUrl: `/uploads/${safeName}`, storageMode: 'local' };
  }

  // --- Coupons, Wishlists, Reviews, Newsletter ---
  validateCoupon(code: string, subtotalPaise: number): Coupon | null {
    const clean = code.trim().toUpperCase();
    const coupon = this.db.coupons.find((c) => c.code.toUpperCase() === clean && c.isActive);
    if (!coupon) return null;
    if (subtotalPaise < coupon.minOrderPaise) return null;
    return coupon;
  }

  getWishlist(userId: string): string[] {
    return this.db.wishlists[userId] || [];
  }

  toggleWishlist(userId: string, productId: string): string[] {
    const current = new Set(this.db.wishlists[userId] || []);
    if (current.has(productId)) {
      current.delete(productId);
    } else {
      current.add(productId);
    }
    this.db.wishlists[userId] = Array.from(current);
    this.saveDatabase();
    return this.db.wishlists[userId];
  }

  addProductReview(productId: string, authorName: string, rating: number, comment: string): ProductReview {
    const product = this.getProductById(productId);
    if (!product) throw new Error('Product not found.');
    const review: ProductReview = {
      id: crypto.randomUUID(),
      productId,
      authorName: authorName.trim(),
      rating: Math.min(5, Math.max(1, Math.round(rating))),
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
    };
    product.reviews = [review, ...(product.reviews || [])];
    this.saveDatabase();
    return review;
  }

  subscribeNewsletter(email: string): { subscribed: boolean; alreadySubscribed: boolean } {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      throw new Error('Please provide a valid email address.');
    }
    if (this.db.newsletterSubscribers.includes(clean)) {
      return { subscribed: true, alreadySubscribed: true };
    }
    this.db.newsletterSubscribers.push(clean);
    this.saveDatabase();
    return { subscribed: true, alreadySubscribed: false };
  }

  // --- Orders & Inventory Security ---
  createPendingOrderFromServerValidation(params: {
    userId?: string | null;
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
  }): Order {
    if (!params.items || params.items.length === 0) {
      throw new Error('Your shopping bag is empty.');
    }

    const orderItems: OrderItem[] = [];
    const cartLikeItems = [];

    for (const reqItem of params.items) {
      const product = this.getProductById(reqItem.productId);
      if (!product || !product.isPublished) {
        throw new Error('One or more items in your bag are no longer available.');
      }
      const variant = product.variants.find((v) => v.id === reqItem.variantId);
      const stockCheck = validateVariantAvailability(variant, reqItem.quantity);
      if (!stockCheck.ok || !variant) {
        throw new Error(`${product.name}: ${stockCheck.reason}`);
      }

      const primaryImg =
        product.images.find((i) => i.isPrimary)?.imageUrl || product.images[0]?.imageUrl || '';

      orderItems.push({
        id: crypto.randomUUID(),
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        brand: product.brand,
        sku: variant.variantSku,
        size: variant.size,
        colorName: variant.colorName,
        imageUrl: primaryImg,
        unitPricePaise: product.sellingPricePaise,
        quantity: reqItem.quantity,
        lineTotalPaise: product.sellingPricePaise * reqItem.quantity,
      });

      cartLikeItems.push({
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        slug: product.slug,
        brand: product.brand,
        sku: variant.variantSku,
        size: variant.size,
        colorName: variant.colorName,
        colorHex: variant.colorHex,
        imageUrl: primaryImg,
        originalPricePaise: product.originalPricePaise,
        sellingPricePaise: product.sellingPricePaise,
        quantity: reqItem.quantity,
        maxStock: variant.stockQuantity,
      });
    }

    const settings = this.getStoreSettings();
    if (params.paymentMethod === 'cod' && !settings.codEnabled) {
      throw new Error('Cash on Delivery is currently disabled.');
    }

    const subtotalPreCoupon = orderItems.reduce((sum, i) => sum + i.lineTotalPaise, 0);
    const coupon = params.couponCode
      ? this.validateCoupon(params.couponCode, subtotalPreCoupon)
      : null;
    const totals = calculateCartTotals(cartLikeItems, settings, coupon);

    const now = new Date().toISOString();
    const orderNumber = `AV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const orderId = crypto.randomUUID();

    const order: Order = {
      id: orderId,
      orderNumber,
      userId: params.userId || null,
      customerName: params.customerName.trim(),
      customerEmail: params.customerEmail.trim().toLowerCase(),
      customerPhone: params.customerPhone.trim(),
      shippingAddress: params.shippingAddress.trim(),
      shippingCity: params.shippingCity.trim(),
      shippingState: params.shippingState.trim(),
      shippingPinCode: params.shippingPinCode.trim(),
      subtotalPaise: totals.subtotalPaise,
      discountPaise: totals.couponDiscountPaise,
      couponCode: coupon ? coupon.code : null,
      shippingPaise: totals.shippingPaise,
      totalPaise: totals.totalPaise,
      paymentMethod: params.paymentMethod,
      paymentStatus: 'pending',
      orderStatus: 'Pending',
      trackingNumber: '',
      carrierName: '',
      inventoryDeducted: false,
      items: orderItems,
      payment: null,
      statusHistory: [
        {
          id: crypto.randomUUID(),
          status: 'Pending',
          note:
            params.paymentMethod === 'cod'
              ? 'Cash on Delivery order placed and awaiting confirmation'
              : 'Order created; awaiting verified Razorpay payment',
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    if (params.paymentMethod === 'cod') {
      // COD orders reserve/deduct inventory immediately upon server validation
      this.deductInventoryForOrderInternal(order);
      order.orderStatus = 'Processing';
      order.statusHistory.push({
        id: crypto.randomUUID(),
        status: 'Processing',
        note: 'COD order verified; inventory reserved for dispatch',
        createdAt: now,
      });
    }

    this.db.orders.unshift(order);
    this.saveDatabase();
    return order;
  }

  attachRazorpayOrderToOrder(orderId: string, razorpayOrderId: string): Order {
    const order = this.db.orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found.');
    order.payment = {
      id: crypto.randomUUID(),
      orderId: order.id,
      gateway: 'razorpay',
      razorpayOrderId,
      amountPaise: order.totalPaise,
      currency: 'INR',
      status: 'created',
    };
    this.saveDatabase();
    return order;
  }

  private deductInventoryForOrderInternal(order: Order): boolean {
    if (order.inventoryDeducted) return false;

    // Validate all lines first so deduction is all-or-nothing
    for (const item of order.items) {
      const product = this.getProductById(item.productId);
      const variant = product?.variants.find((v) => v.id === item.variantId);
      if (!variant || variant.stockQuantity < item.quantity) {
        throw new Error(`Insufficient stock for ${item.productName} (${item.size} / ${item.colorName}).`);
      }
    }

    for (const item of order.items) {
      const product = this.getProductById(item.productId)!;
      const variant = product.variants.find((v) => v.id === item.variantId)!;
      variant.stockQuantity -= item.quantity;
      product.popularityScore += item.quantity;
    }

    order.inventoryDeducted = true;
    return true;
  }

  markOrderPaidIdempotent(params: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature?: string;
    method?: string;
    source: 'checkout_callback' | 'webhook';
  }): { order: Order; alreadyProcessed: boolean } {
    const order = this.db.orders.find((o) => o.id === params.orderId);
    if (!order) throw new Error('Order not found.');

    if (order.paymentStatus === 'paid' && order.inventoryDeducted) {
      return { order, alreadyProcessed: true };
    }

    const now = new Date().toISOString();
    this.deductInventoryForOrderInternal(order);

    order.paymentStatus = 'paid';
    order.orderStatus = 'Paid';
    order.updatedAt = now;
    order.payment = {
      id: order.payment?.id || crypto.randomUUID(),
      orderId: order.id,
      gateway: 'razorpay',
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: params.razorpayPaymentId,
      razorpaySignature: params.razorpaySignature,
      amountPaise: order.totalPaise,
      currency: 'INR',
      method: params.method || 'upi/card',
      status: 'captured',
      verifiedAt: now,
    };
    order.statusHistory.push({
      id: crypto.randomUUID(),
      status: 'Paid',
      note:
        params.source === 'webhook'
          ? `Razorpay webhook verified (${params.razorpayPaymentId})`
          : `Razorpay signature verified (${params.razorpayPaymentId})`,
      createdAt: now,
    });

    this.saveDatabase();
    return { order, alreadyProcessed: false };
  }

  markOrderPaymentFailed(orderId: string, reason: string): Order {
    const order = this.db.orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found.');
    if (order.paymentStatus === 'paid') return order;

    const now = new Date().toISOString();
    order.paymentStatus = 'failed';
    order.updatedAt = now;
    if (order.payment) {
      order.payment.status = 'failed';
      order.payment.failureReason = reason;
    }
    order.statusHistory.push({
      id: crypto.randomUUID(),
      status: order.orderStatus,
      note: `Payment failed: ${reason}`,
      createdAt: now,
    });
    this.saveDatabase();
    return order;
  }

  hasProcessedWebhookEvent(eventId: string): boolean {
    return this.db.processedWebhookEvents.includes(eventId);
  }

  recordWebhookEvent(eventId: string): void {
    if (!this.db.processedWebhookEvents.includes(eventId)) {
      this.db.processedWebhookEvents.push(eventId);
      this.saveDatabase();
    }
  }

  findOrderByRazorpayOrderId(razorpayOrderId: string): Order | undefined {
    return this.db.orders.find((o) => o.payment?.razorpayOrderId === razorpayOrderId);
  }

  getOrderById(orderId: string): Order | undefined {
    return this.db.orders.find((o) => o.id === orderId);
  }

  getOrdersForUser(userId: string): Order[] {
    return this.db.orders.filter((o) => o.userId === userId);
  }

  getAllOrdersAdmin(): Order[] {
    return [...this.db.orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  updateOrderStatusAdmin(params: {
    orderId: string;
    orderStatus: OrderStatus;
    trackingNumber?: string;
    carrierName?: string;
    note?: string;
  }): Order {
    const order = this.getOrderById(params.orderId);
    if (!order) throw new Error('Order not found.');

    const now = new Date().toISOString();
    order.orderStatus = params.orderStatus;
    if (typeof params.trackingNumber === 'string') {
      order.trackingNumber = params.trackingNumber.trim();
    }
    if (typeof params.carrierName === 'string') {
      order.carrierName = params.carrierName.trim();
    }
    if (params.orderStatus === 'Refunded') {
      order.paymentStatus = 'refunded';
      if (order.payment) order.payment.status = 'refunded';
    }
    order.updatedAt = now;

    order.statusHistory.push({
      id: crypto.randomUUID(),
      status: params.orderStatus,
      note:
        params.note?.trim() ||
        (order.trackingNumber
          ? `Order updated to ${params.orderStatus} (${order.carrierName || 'Courier'}: ${order.trackingNumber})`
          : `Order status updated to ${params.orderStatus}`),
      createdAt: now,
    });

    this.saveDatabase();
    return order;
  }

  // --- Admin Analytics ---
  getDashboardOverview(): DashboardOverview {
    const orders = this.getAllOrdersAdmin();
    const products = this.getAllProductsAdmin();
    const customers = this.db.users.filter((u) => u.role === 'customer');

    const pendingOrders = orders.filter((o) =>
      ['Pending', 'Paid', 'Processing'].includes(o.orderStatus)
    ).length;
    const completedOrders = orders.filter((o) => o.orderStatus === 'Delivered').length;
    const totalRevenuePaise = orders
      .filter((o) => o.paymentStatus === 'paid' || o.orderStatus === 'Delivered')
      .reduce((sum, o) => sum + o.totalPaise, 0);

    const lowStockItems: DashboardOverview['lowStockItems'] = [];
    for (const p of products) {
      for (const v of p.variants) {
        if (v.isActive && v.stockQuantity <= v.lowStockThreshold) {
          lowStockItems.push({
            productId: p.id,
            productName: p.name,
            variantId: v.id,
            variantSku: v.variantSku,
            size: v.size,
            colorName: v.colorName,
            stockQuantity: v.stockQuantity,
            lowStockThreshold: v.lowStockThreshold,
          });
        }
      }
    }

    return {
      totalOrders: orders.length,
      totalProducts: products.length,
      totalCustomers: customers.length,
      pendingOrders,
      completedOrders,
      totalRevenuePaise,
      recentOrders: orders.slice(0, 6),
      lowStockItems: lowStockItems.sort((a, b) => a.stockQuantity - b.stockQuantity),
    };
  }
}

export const storeRepo = new StoreRepository();
