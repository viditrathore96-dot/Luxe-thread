import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCartTotals,
  calculateDiscountPercent,
  filterAndSortProducts,
  formatPaiseToINR,
  validateCheckoutInput,
  validateVariantAvailability,
} from './commerce';
import type { CartItem, Coupon, Product } from '../types/ecommerce';

test('formatPaiseToINR formats paise cleanly without floating point artifacts', () => {
  assert.equal(formatPaiseToINR(2450000), '₹24,500');
  assert.equal(formatPaiseToINR(35000), '₹350');
  assert.equal(formatPaiseToINR(0), '₹0');
});

test('calculateDiscountPercent computes accurate integer discount percentage', () => {
  assert.equal(calculateDiscountPercent(2000000, 1500000), 25);
  assert.equal(calculateDiscountPercent(1000000, 1000000), 0);
  assert.equal(calculateDiscountPercent(0, 500000), 0);
});

test('calculateCartTotals computes subtotal, coupon, and free shipping threshold', () => {
  const items: CartItem[] = [
    {
      productId: 'p1',
      variantId: 'v1',
      productName: 'Cashmere Overcoat',
      slug: 'cashmere-overcoat',
      brand: 'Atelier Vanya',
      sku: 'AV-01',
      size: 'M',
      colorName: 'Ivory',
      colorHex: '#F3EFE6',
      imageUrl: '',
      originalPricePaise: 1200000,
      sellingPricePaise: 1000000,
      quantity: 1,
      maxStock: 5,
    },
  ];
  const settings = {
    shippingFeePaise: 35000,
    freeShippingThresholdPaise: 1500000,
  };

  const underThreshold = calculateCartTotals(items, settings);
  assert.equal(underThreshold.subtotalPaise, 1000000);
  assert.equal(underThreshold.productSavingsPaise, 200000);
  assert.equal(underThreshold.shippingPaise, 35000);
  assert.equal(underThreshold.totalPaise, 1035000);
  assert.equal(underThreshold.amountToFreeShippingPaise, 500000);

  const coupon: Coupon = {
    code: 'VANYA10',
    discountType: 'percent',
    discountValue: 10,
    minOrderPaise: 500000,
    isActive: true,
  };

  const withTwoAndCoupon = calculateCartTotals([{ ...items[0], quantity: 2 }], settings, coupon);
  assert.equal(withTwoAndCoupon.subtotalPaise, 2000000);
  assert.equal(withTwoAndCoupon.couponDiscountPaise, 200000);
  assert.equal(withTwoAndCoupon.shippingPaise, 0);
  assert.equal(withTwoAndCoupon.totalPaise, 1800000);
});

test('validateCheckoutInput rejects invalid Indian PIN codes, phones, and empty fields', () => {
  const invalid = validateCheckoutInput({
    customerName: 'A',
    customerEmail: 'bad-email',
    customerPhone: '12345',
    shippingAddress: 'Short',
    shippingCity: '',
    shippingState: '',
    shippingPinCode: '012345',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.customerName);
  assert.ok(invalid.errors.customerEmail);
  assert.ok(invalid.errors.customerPhone);
  assert.ok(invalid.errors.shippingAddress);
  assert.ok(invalid.errors.shippingCity);
  assert.ok(invalid.errors.shippingState);
  assert.ok(invalid.errors.shippingPinCode);

  const valid = validateCheckoutInput({
    customerName: 'Ananya Sharma',
    customerEmail: 'ananya@example.com',
    customerPhone: '9876543210',
    shippingAddress: '42 Jor Bagh Road, Block B',
    shippingCity: 'New Delhi',
    shippingState: 'Delhi',
    shippingPinCode: '110003',
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});
});

test('validateVariantAvailability enforces stock boundaries', () => {
  assert.equal(validateVariantAvailability({ isActive: true, stockQuantity: 3 }, 2).ok, true);
  assert.equal(validateVariantAvailability({ isActive: true, stockQuantity: 3 }, 4).ok, false);
  assert.equal(validateVariantAvailability({ isActive: true, stockQuantity: 0 }, 1).ok, false);
  assert.equal(validateVariantAvailability({ isActive: false, stockQuantity: 5 }, 1).ok, false);
});

test('filterAndSortProducts respects published status, size availability, and price sort', () => {
  const baseProduct: Product = {
    id: 'p1',
    categoryId: 'c1',
    categoryName: 'Outerwear',
    categorySlug: 'outerwear',
    name: 'Ivory Coat',
    slug: 'ivory-coat',
    brand: 'Atelier Vanya',
    description: 'Cashmere coat',
    fabricCare: 'Dry clean',
    sku: 'AV-1',
    originalPricePaise: 3000000,
    sellingPricePaise: 2500000,
    isPublished: true,
    isFeatured: true,
    isNewArrival: true,
    popularityScore: 90,
    images: [],
    variants: [
      {
        id: 'v1',
        productId: 'p1',
        size: 'M',
        colorName: 'Ivory',
        colorHex: '#F3EFE6',
        variantSku: 'AV-1-M',
        stockQuantity: 4,
        lowStockThreshold: 2,
        isActive: true,
      },
    ],
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };

  const unpublished: Product = { ...baseProduct, id: 'p2', name: 'Draft Coat', isPublished: false };
  const cheaper: Product = {
    ...baseProduct,
    id: 'p3',
    name: 'Silk Shirt',
    sellingPricePaise: 900000,
    variants: [{ ...baseProduct.variants[0], id: 'v2', size: 'L', stockQuantity: 2 }],
  };

  const res = filterAndSortProducts([baseProduct, unpublished, cheaper], {
    sortBy: 'price_asc',
  });
  assert.deepEqual(
    res.map((p) => p.id),
    ['p3', 'p1']
  );

  const sizeM = filterAndSortProducts([baseProduct, cheaper], { size: 'M' });
  assert.deepEqual(
    sizeM.map((p) => p.id),
    ['p1']
  );
});
