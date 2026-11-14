import React, { useState } from 'react';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { api } from '../lib/api';
import { formatPaiseToINR } from '../utils/commerce';

export function CartDrawer() {
  const {
    isCartOpen,
    setIsCartOpen,
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
  const [couponLoading, setCouponLoading] = useState(false);

  if (!isCartOpen) return null;

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    try {
      const res = await api.validateCoupon(couponInput, cartTotals.subtotalPaise);
      setAppliedCoupon(res.coupon);
      showToast(`Coupon ${res.coupon.code} applied.`, 'success');
      setCouponInput('');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setCouponLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Shopping Bag">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={() => setIsCartOpen(false)}
      />
      <aside className="relative z-10 w-full max-w-md bg-[#FAF9F6] h-full flex flex-col border-l border-[#E5E1D8]">
        <div className="px-6 py-5 border-b border-[#E5E1D8] flex items-center justify-between">
          <div>
            <h2 className="font-editorial text-2xl font-medium text-[#141413]">Shopping Bag</h2>
            <p className="text-xs text-[#6B6860] tabular-nums">{cartTotals.itemCount} piece(s) selected</p>
          </div>
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            aria-label="Close shopping bag"
            className="p-2 text-[#141413] hover:opacity-70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free shipping progress */}
        {cart.length > 0 && (
          <div className="px-6 py-3 bg-[#F3F0E8] border-b border-[#E5E1D8] text-xs text-[#3C3A36]">
            {cartTotals.amountToFreeShippingPaise === 0 ? (
              <span>Your order qualifies for complimentary express shipping across India.</span>
            ) : (
              <span>
                Add <strong className="tabular-nums">{formatPaiseToINR(cartTotals.amountToFreeShippingPaise)}</strong> more for complimentary express shipping.
              </span>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {cart.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <p className="font-editorial text-xl text-[#141413]">Your bag is currently empty</p>
              <p className="text-sm text-[#6B6860]">
                Explore our seasonal cashmere, silk shirting, and Belgian linen pieces.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  navigate('/shop');
                }}
                className="px-6 py-3 bg-[#141413] text-[#FAF9F6] text-xs font-medium hover:bg-[#2C2B29] transition-colors"
              >
                Browse Collection
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.variantId} className="flex gap-4 pb-6 border-b border-[#EAE6DD] last:border-b-0">
                <div className="w-20 h-28 bg-[#EFECE5] shrink-0 overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#E5E1D8]" />
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <a
                        href={`/product/${item.slug}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setIsCartOpen(false);
                          navigate(`/product/${item.slug}`);
                        }}
                        className="text-sm font-medium text-[#141413] hover:underline truncate"
                      >
                        {item.productName}
                      </a>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.variantId)}
                        aria-label={`Remove ${item.productName}`}
                        className="text-[#88847C] hover:text-[#141413] p-1 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-[#6B6860] mt-1">
                      Size {item.size} · {item.colorName}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center border border-[#D8D3C8]">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.variantId, item.quantity - 1)}
                        aria-label={`Decrease quantity for ${item.productName}`}
                        className="w-8 h-8 flex items-center justify-center text-[#141413] hover:bg-[#EFECE5]"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-medium tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.variantId, item.quantity + 1)}
                        aria-label={`Increase quantity for ${item.productName}`}
                        className="w-8 h-8 flex items-center justify-center text-[#141413] hover:bg-[#EFECE5]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="text-sm font-semibold tabular-nums text-[#141413]">
                      {formatPaiseToINR(item.sellingPricePaise * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t border-[#E5E1D8] p-6 bg-[#F6F4EE] space-y-4">
            {/* Coupon field */}
            {appliedCoupon ? (
              <div className="flex items-center justify-between text-xs bg-[#FAF9F6] border border-[#D8D3C8] px-3 py-2">
                <span>
                  Coupon <strong>{appliedCoupon.code}</strong> applied
                </span>
                <button
                  type="button"
                  onClick={() => setAppliedCoupon(null)}
                  className="text-[#6B6860] hover:text-[#141413] underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <label htmlFor="drawer-coupon" className="sr-only">
                  Promotional code
                </label>
                <input
                  id="drawer-coupon"
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Promo code (e.g. VANYA10)"
                  className="flex-1 bg-[#FAF9F6] border border-[#D8D3C8] px-3 py-2 text-xs focus:outline-none focus:border-[#141413]"
                />
                <button
                  type="submit"
                  disabled={couponLoading}
                  className="px-4 py-2 border border-[#141413] text-xs font-medium text-[#141413] hover:bg-[#141413] hover:text-[#FAF9F6] transition-colors whitespace-nowrap"
                >
                  Apply
                </button>
              </form>
            )}

            <div className="space-y-1.5 text-sm tabular-nums">
              <div className="flex justify-between text-[#52504B]">
                <span>Subtotal</span>
                <span>{formatPaiseToINR(cartTotals.subtotalPaise)}</span>
              </div>
              {cartTotals.couponDiscountPaise > 0 && (
                <div className="flex justify-between text-[#2E5E4E]">
                  <span>Coupon Discount</span>
                  <span>-{formatPaiseToINR(cartTotals.couponDiscountPaise)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#52504B]">
                <span>Shipping</span>
                <span>
                  {cartTotals.shippingPaise === 0 ? 'Complimentary' : formatPaiseToINR(cartTotals.shippingPaise)}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-base text-[#141413] pt-2 border-t border-[#E0DBD0]">
                <span>Estimated Total</span>
                <span>{formatPaiseToINR(cartTotals.totalPaise)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  navigate('/cart');
                }}
                className="py-3 border border-[#141413] text-xs font-semibold text-[#141413] hover:bg-[#EFECE5] transition-colors"
              >
                View Bag
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  navigate('/checkout');
                }}
                className="py-3 bg-[#141413] text-[#FAF9F6] text-xs font-semibold hover:bg-[#2C2B29] transition-colors"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
