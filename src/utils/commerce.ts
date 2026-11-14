import type { CartItem, Coupon, Product, ProductVariant, StoreSettings } from '../types/ecommerce';

/**
 * Formats an integer amount in paise to an Indian Rupee string (e.g., 2450000 -> ₹24,500).
 */
export function formatPaiseToINR(paise: number): string {
  const safePaise = Number.isFinite(paise) ? Math.max(0, Math.round(paise)) : 0;
  const rupees = safePaise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(rupees);
}

/**
 * Calculates integer discount percentage between original and selling price in paise.
 */
export function calculateDiscountPercent(originalPaise: number, sellingPaise: number): number {
  if (originalPaise <= 0 || sellingPaise >= originalPaise) return 0;
  return Math.round(((originalPaise - sellingPaise) / originalPaise) * 100);
}

export interface CartTotals {
  itemCount: number;
  originalSubtotalPaise: number;
  subtotalPaise: number;
  productSavingsPaise: number;
  couponDiscountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  amountToFreeShippingPaise: number;
}

/**
 * Computes deterministic cart totals in integer paise.
 */
export function calculateCartTotals(
  items: CartItem[],
  settings: Pick<StoreSettings, 'shippingFeePaise' | 'freeShippingThresholdPaise'>,
  coupon?: Coupon | null
): CartTotals {
  let itemCount = 0;
  let originalSubtotalPaise = 0;
  let subtotalPaise = 0;

  for (const item of items) {
    const qty = Math.max(0, Math.floor(item.quantity));
    if (qty === 0) continue;
    itemCount += qty;
    originalSubtotalPaise += item.originalPricePaise * qty;
    subtotalPaise += item.sellingPricePaise * qty;
  }

  const productSavingsPaise = Math.max(0, originalSubtotalPaise - subtotalPaise);

  let couponDiscountPaise = 0;
  if (coupon && coupon.isActive && subtotalPaise >= coupon.minOrderPaise && subtotalPaise > 0) {
    if (coupon.discountType === 'percent') {
      couponDiscountPaise = Math.round((subtotalPaise * coupon.discountValue) / 100);
    } else {
      couponDiscountPaise = Math.min(subtotalPaise, coupon.discountValue);
    }
  }

  const discountedSubtotal = Math.max(0, subtotalPaise - couponDiscountPaise);
  const qualifiesForFreeShipping =
    discountedSubtotal === 0 || discountedSubtotal >= settings.freeShippingThresholdPaise;
  const shippingPaise = qualifiesForFreeShipping ? 0 : settings.shippingFeePaise;
  const totalPaise = discountedSubtotal + shippingPaise;
  const amountToFreeShippingPaise = qualifiesForFreeShipping
    ? 0
    : Math.max(0, settings.freeShippingThresholdPaise - discountedSubtotal);

  return {
    itemCount,
    originalSubtotalPaise,
    subtotalPaise,
    productSavingsPaise,
    couponDiscountPaise,
    shippingPaise,
    totalPaise,
    amountToFreeShippingPaise,
  };
}

export interface CheckoutFormInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPinCode: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof CheckoutFormInput, string>>;
}

/**
 * Validates customer shipping & contact inputs strictly (including Indian 6-digit PIN code).
 */
export function validateCheckoutInput(input: CheckoutFormInput): ValidationResult {
  const errors: Partial<Record<keyof CheckoutFormInput, string>> = {};

  if (!input.customerName || input.customerName.trim().length < 2) {
    errors.customerName = 'Please enter the recipient full name.';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!input.customerEmail || !emailRegex.test(input.customerEmail.trim())) {
    errors.customerEmail = 'Please enter a valid email address.';
  }

  const normalizedPhone = input.customerPhone.replace(/[\s\-+]/g, '');
  if (!/^(91)?[6-9][0-9]{9}$/.test(normalizedPhone)) {
    errors.customerPhone = 'Enter a valid 10-digit Indian mobile number.';
  }

  if (!input.shippingAddress || input.shippingAddress.trim().length < 8) {
    errors.shippingAddress = 'Please provide a complete street address and building/flat number.';
  }

  if (!input.shippingCity || input.shippingCity.trim().length < 2) {
    errors.shippingCity = 'Please enter a valid city.';
  }

  if (!input.shippingState || input.shippingState.trim().length < 2) {
    errors.shippingState = 'Please select or enter your state.';
  }

  if (!/^[1-9][0-9]{5}$/.test(input.shippingPinCode.trim())) {
    errors.shippingPinCode = 'Enter a valid 6-digit Indian PIN code.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates whether a requested quantity can be fulfilled by the selected variant.
 */
export function validateVariantAvailability(
  variant: Pick<ProductVariant, 'isActive' | 'stockQuantity'> | undefined,
  requestedQty: number
): { ok: boolean; reason?: string } {
  if (!variant || !variant.isActive) {
    return { ok: false, reason: 'This size and colour combination is currently unavailable.' };
  }
  if (variant.stockQuantity <= 0) {
    return { ok: false, reason: 'Out of stock for this variant.' };
  }
  if (!Number.isInteger(requestedQty) || requestedQty < 1) {
    return { ok: false, reason: 'Quantity must be at least 1.' };
  }
  if (requestedQty > variant.stockQuantity) {
    return { ok: false, reason: `Only ${variant.stockQuantity} unit(s) available in stock.` };
  }
  return { ok: true };
}

export function getPrimaryProductImage(product: Pick<Product, 'images'>): string {
  if (!product.images || product.images.length === 0) return '';
  const primary = product.images.find((img) => img.isPrimary);
  if (primary) return primary.imageUrl;
  return [...product.images].sort((a, b) => a.sortOrder - b.sortOrder)[0].imageUrl;
}

export function getTotalProductStock(product: Pick<Product, 'variants'>): number {
  return product.variants.reduce((sum, v) => sum + (v.isActive ? Math.max(0, v.stockQuantity) : 0), 0);
}

export interface ProductFilterOptions {
  search?: string;
  categorySlug?: string;
  size?: string;
  colorName?: string;
  minPricePaise?: number;
  maxPricePaise?: number;
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
}

export function filterAndSortProducts(products: Product[], options: ProductFilterOptions): Product[] {
  const query = (options.search || '').trim().toLowerCase();

  const filtered = products.filter((p) => {
    if (!p.isPublished) return false;

    if (query) {
      const matchesQuery =
        p.name.toLowerCase().includes(query) ||
        p.brand.toLowerCase().includes(query) ||
        p.categoryName.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query);
      if (!matchesQuery) return false;
    }

    if (options.categorySlug && options.categorySlug !== 'all' && p.categorySlug !== options.categorySlug) {
      return false;
    }

    if (options.size && options.size !== 'all') {
      const hasSize = p.variants.some(
        (v) => v.isActive && v.size === options.size && v.stockQuantity > 0
      );
      if (!hasSize) return false;
    }

    if (options.colorName && options.colorName !== 'all') {
      const hasColor = p.variants.some(
        (v) => v.isActive && v.colorName.toLowerCase() === options.colorName!.toLowerCase() && v.stockQuantity > 0
      );
      if (!hasColor) return false;
    }

    if (typeof options.minPricePaise === 'number' && p.sellingPricePaise < options.minPricePaise) {
      return false;
    }

    if (typeof options.maxPricePaise === 'number' && p.sellingPricePaise > options.maxPricePaise) {
      return false;
    }

    return true;
  });

  const sorted = [...filtered];
  switch (options.sortBy) {
    case 'price_asc':
      sorted.sort((a, b) => a.sellingPricePaise - b.sellingPricePaise);
      break;
    case 'price_desc':
      sorted.sort((a, b) => b.sellingPricePaise - a.sellingPricePaise);
      break;
    case 'popular':
      sorted.sort((a, b) => b.popularityScore - a.popularityScore);
      break;
    case 'newest':
    default:
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
  }

  return sorted;
}
