import React, { useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { api } from '../lib/api';
import { formatPaiseToINR } from '../utils/commerce';

export function CartPage() {
  const {
    cart,
    cartTotals,
    updateCartQuantity,
    removeFromCart,
    appliedCoupon,
    setAppliedCoupon,
    navigate,
    showToast,
  } = useStore();
  const [couponInput, setCouponInput] = useState('');

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    try {
      const res = await api.validateCoupon(couponInput, cartTotals.subtotalPaise);
      setAppliedCoupon(res.coupon);
      showToast(`Coupon ${res.coupon.code} applied.`, 'success');
      setCouponInput('');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <h1 className="font-editorial text-4xl font-medium text-[#141413] mb-8">Shopping Bag</h1>

      {cart.length === 0 ? (
        <div className="py-20 text-center border border-[#E5E1D8] bg-[#F6F4EE] space-y-4">
          <p className="font-editorial text-2xl text-[#141413]">Your bag is empty</p>
          <p className="text-sm text-[#6B6860]">Discover tailored outerwear, mulberry silk shirting, and linen trousers.</p>
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="px-7 py-3 bg-[#141413] text-[#FAF9F6] text-xs font-semibold uppercase tracking-wider"
          >
            Explore Collection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 divide-y divide-[#E5E1D8] border-t border-b border-[#E5E1D8]">
            {cart.map((item) => (
              <div key={item.variantId} className="py-6 flex gap-6">
                <div className="w-24 h-32 bg-[#EFECE5] shrink-0 overflow-hidden">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="text-xs text-[#6B6860]">{item.brand} · {item.sku}</p>
                      <a
                        href={`/product/${item.slug}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/product/${item.slug}`);
                        }}
                        className="text-base font-medium text-[#141413] hover:underline"
                      >
                        {item.productName}
                      </a>
                      <p className="text-xs text-[#6B6860] mt-1">
                        Size: {item.size} · Colour: {item.colorName}
                      </p>
                    </div>
                    <span className="text-base font-semibold tabular-nums text-[#141413]">
                      {formatPaiseToINR(item.sellingPricePaise * item.quantity)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center border border-[#D8D3C8]">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.variantId, item.quantity - 1)}
                        aria-label={`Decrease quantity for ${item.productName}`}
                        className="w-9 h-9 flex items-center justify-center hover:bg-[#EFECE5]"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-10 text-center text-xs font-medium tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.variantId, item.quantity + 1)}
                        aria-label={`Increase quantity for ${item.productName}`}
                        className="w-9 h-9 flex items-center justify-center hover:bg-[#EFECE5]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.variantId)}
                      className="inline-flex items-center gap-1.5 text-xs text-[#6B6860] hover:text-[#141413]"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="lg:col-span-4 bg-[#F6F4EE] border border-[#E5E1D8] p-6 space-y-5 h-fit">
            <h2 className="font-editorial text-2xl font-medium text-[#141413]">Order Summary</h2>

            {appliedCoupon ? (
              <div className="flex items-center justify-between text-xs bg-[#FAF9F6] border border-[#D8D3C8] px-3 py-2.5">
                <span>
                  Coupon <strong>{appliedCoupon.code}</strong> active
                </span>
                <button
                  type="button"
                  onClick={() => setAppliedCoupon(null)}
                  className="underline text-[#6B6860] hover:text-[#141413]"
                >
                  Remove
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Promo code (VANYA10)"
                  className="flex-1 bg-[#FAF9F6] border border-[#D8D3C8] px-3 py-2 text-xs focus:outline-none focus:border-[#141413]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 border border-[#141413] text-xs font-medium hover:bg-[#141413] hover:text-[#FAF9F6] transition-colors"
                >
                  Apply
                </button>
              </form>
            )}

            <div className="space-y-2.5 text-sm tabular-nums pt-2 border-t border-[#E5E1D8]">
              <div className="flex justify-between text-[#52504B]">
                <span>Subtotal ({cartTotals.itemCount} items)</span>
                <span>{formatPaiseToINR(cartTotals.subtotalPaise)}</span>
              </div>
              {cartTotals.productSavingsPaise > 0 && (
                <div className="flex justify-between text-[#2E5E4E]">
                  <span>Catalog Savings</span>
                  <span>-{formatPaiseToINR(cartTotals.productSavingsPaise)}</span>
                </div>
              )}
              {cartTotals.couponDiscountPaise > 0 && (
                <div className="flex justify-between text-[#2E5E4E]">
                  <span>Promo Discount</span>
                  <span>-{formatPaiseToINR(cartTotals.couponDiscountPaise)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#52504B]">
                <span>Shipping</span>
                <span>
                  {cartTotals.shippingPaise === 0 ? 'Complimentary' : formatPaiseToINR(cartTotals.shippingPaise)}
                </span>
              </div>
              <div className="flex justify-between text-base font-semibold text-[#141413] pt-3 border-t border-[#DFDBD0]">
                <span>Total</span>
                <span>{formatPaiseToINR(cartTotals.totalPaise)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="w-full py-3.5 bg-[#141413] text-[#FAF9F6] text-xs font-semibold uppercase tracking-wider hover:bg-[#2C2B29] transition-colors"
            >
              Proceed to Checkout
            </button>
          </aside>
        </div>
      )}
    </main>
  );
}
