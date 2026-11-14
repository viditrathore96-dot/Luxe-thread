import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { api } from '../lib/api';
import { formatPaiseToINR, validateCheckoutInput, type CheckoutFormInput } from '../utils/commerce';
import type { Address, Order, PaymentMethod } from '../types/ecommerce';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, cb: (res: { error?: { description?: string } }) => void) => void;
    };
  }
}

export function CheckoutPage() {
  const {
    user,
    cart,
    cartTotals,
    settings,
    appliedCoupon,
    clearCart,
    refreshCatalog,
    navigate,
    showToast,
  } = useStore();

  const [form, setForm] = useState<CheckoutFormInput>({
    customerName: user?.fullName || '',
    customerEmail: user?.email || '',
    customerPhone: user?.phone || '',
    shippingAddress: '',
    shippingCity: '',
    shippingState: '',
    shippingPinCode: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutFormInput, string>>>({});
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('razorpay');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Pending Razorpay test-mode verification state (used when RAZORPAY_KEY_ID isn't configured in .env)
  const [pendingGatewaySession, setPendingGatewaySession] = useState<{
    order: Order;
    razorpayOrderId: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        customerName: prev.customerName || user.fullName,
        customerEmail: prev.customerEmail || user.email,
        customerPhone: prev.customerPhone || user.phone,
      }));
      api
        .getAddresses()
        .then((res) => {
          setSavedAddresses(res.addresses);
          const def = res.addresses.find((a) => a.isDefault) || res.addresses[0];
          if (def) {
            setForm((prev) => ({
              ...prev,
              customerName: def.recipientName,
              customerPhone: def.phone,
              shippingAddress: def.streetAddress,
              shippingCity: def.city,
              shippingState: def.state,
              shippingPinCode: def.pinCode,
            }));
          }
        })
        .catch(() => {});
    }
  }, [user]);

  if (cart.length === 0 && !pendingGatewaySession) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-editorial text-3xl text-[#141413]">Your bag is empty</h1>
        <p className="text-sm text-[#6B6860]">Add garments before proceeding to checkout.</p>
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="px-6 py-3 bg-[#141413] text-[#FAF9F6] text-xs font-semibold uppercase tracking-wider"
        >
          Return to Shop
        </button>
      </main>
    );
  }

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    const check = validateCheckoutInput(form);
    if (!check.valid) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const res = await api.createCheckoutOrder({
        ...form,
        paymentMethod,
        couponCode: appliedCoupon?.code,
        items: cart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      });

      if (paymentMethod === 'cod') {
        clearCart();
        await refreshCatalog();
        showToast('Order placed successfully.', 'success');
        navigate(`/order/${res.order.id}`);
        return;
      }

      if (res.razorpayOrder && res.razorpayKeyId && window.Razorpay) {
        const rzp = new window.Razorpay({
          key: res.razorpayKeyId,
          amount: res.razorpayOrder.amount,
          currency: res.razorpayOrder.currency,
          name: settings.storeName,
          description: `Order ${res.order.orderNumber}`,
          order_id: res.razorpayOrder.id,
          prefill: {
            name: form.customerName,
            email: form.customerEmail,
            contact: form.customerPhone,
          },
          theme: { color: '#141413' },
          handler: async (paymentResponse: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const verified = await api.verifyRazorpayPayment({
                orderId: res.order.id,
                razorpayOrderId: paymentResponse.razorpay_order_id,
                razorpayPaymentId: paymentResponse.razorpay_payment_id,
                razorpaySignature: paymentResponse.razorpay_signature,
              });
              clearCart();
              await refreshCatalog();
              navigate(`/order/${verified.order.id}`);
            } catch (verifyErr) {
              setServerError((verifyErr as Error).message);
            }
          },
        });
        rzp.on('payment.failed', async (failRes) => {
          await api.failRazorpayPayment(
            res.order.id,
            failRes.error?.description || 'Payment failed in Razorpay Checkout'
          );
          setServerError(failRes.error?.description || 'Payment failed. Please try again.');
        });
        rzp.open();
      } else if (res.razorpayOrder) {
        // Test-mode verification panel when live Razorpay API credentials are not configured
        setPendingGatewaySession({
          order: res.order,
          razorpayOrderId: res.razorpayOrder.id,
        });
      }
    } catch (err) {
      const apiErr = err as Error & { errors?: Partial<Record<keyof CheckoutFormInput, string>> };
      if (apiErr.errors) setErrors(apiErr.errors);
      setServerError(apiErr.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestModeVerify = async () => {
    if (!pendingGatewaySession) return;
    setSubmitting(true);
    setServerError('');
    try {
      const testPaymentId = `pay_test_${Date.now()}`;
      const verified = await api.verifyRazorpayPayment({
        orderId: pendingGatewaySession.order.id,
        razorpayOrderId: pendingGatewaySession.razorpayOrderId,
        razorpayPaymentId: testPaymentId,
        simulateTestSignature: true,
        paymentMethodLabel: 'upi_test_mode',
      });
      clearCart();
      await refreshCatalog();
      showToast('Payment signature verified and order confirmed.', 'success');
      navigate(`/order/${verified.order.id}`);
    } catch (err) {
      setServerError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestModeFail = async () => {
    if (!pendingGatewaySession) return;
    setSubmitting(true);
    try {
      await api.failRazorpayPayment(
        pendingGatewaySession.order.id,
        'Customer cancelled or simulated test payment failure'
      );
      setServerError('Payment failed — your pending order was recorded as failed and inventory was not deducted. You may retry checkout.');
      setPendingGatewaySession(null);
    } catch (err) {
      setServerError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="mb-8 pb-6 border-b border-[#E5E1D8] flex items-center justify-between">
        <div>
          <p className="text-xs text-[#6B6860] uppercase tracking-wider mb-1">Secure Checkout</p>
          <h1 className="font-editorial text-4xl font-medium text-[#141413]">Delivery & Payment</h1>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-[#6B6860]">
          <Lock className="w-3.5 h-3.5" />
          <span>Server-validated pricing & stock</span>
        </div>
      </div>

      {serverError && (
        <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 text-sm text-red-900">
          {serverError}
        </div>
      )}

      {pendingGatewaySession ? (
        <div className="max-w-2xl mx-auto bg-[#F6F4EE] border border-[#D8D3C8] p-8 space-y-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-[#141413] shrink-0 mt-0.5" />
            <div>
              <h2 className="font-editorial text-2xl font-medium text-[#141413]">
                Razorpay Test-Mode Verification
              </h2>
              <p className="text-sm text-[#52504B] mt-1">
                Order <strong>{pendingGatewaySession.order.orderNumber}</strong> has been created in <code>Pending</code> status for{' '}
                <strong className="tabular-nums">{formatPaiseToINR(pendingGatewaySession.order.totalPaise)}</strong>.
              </p>
              <p className="text-xs text-[#6B6860] mt-2">
                Live Razorpay Checkout opens automatically once <code>RAZORPAY_KEY_ID</code> and{' '}
                <code>RAZORPAY_KEY_SECRET</code> are configured in your environment. Until then, you can exercise the real server-side HMAC-SHA256 verification and failure paths below.
              </p>
            </div>
          </div>

          <div className="bg-[#FAF9F6] border border-[#E5E1D8] p-4 text-xs font-mono space-y-1">
            <p>Order ID: {pendingGatewaySession.order.id}</p>
            <p>Gateway Order ID: {pendingGatewaySession.razorpayOrderId}</p>
            <p>Payment Status: {pendingGatewaySession.order.paymentStatus}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={handleTestModeVerify}
              className="flex-1 py-3.5 bg-[#141413] text-[#FAF9F6] text-xs font-semibold uppercase tracking-wider hover:bg-[#2C2B29] disabled:opacity-50"
            >
              {submitting ? 'Verifying HMAC...' : 'Verify Test Payment (UPI / Card)'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleTestModeFail}
              className="py-3.5 px-6 border border-[#D8D3C8] text-xs font-semibold uppercase tracking-wider text-[#52504B] hover:border-[#141413] hover:text-[#141413]"
            >
              Simulate Payment Failure
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCheckoutSubmit} noValidate className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 space-y-8">
            {savedAddresses.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#141413]">
                  Saved Addresses
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          customerName: addr.recipientName,
                          customerPhone: addr.phone,
                          shippingAddress: addr.streetAddress,
                          shippingCity: addr.city,
                          shippingState: addr.state,
                          shippingPinCode: addr.pinCode,
                        }))
                      }
                      className="text-left p-3.5 border border-[#D8D3C8] hover:border-[#141413] bg-[#FAF9F6]"
                    >
                      <p className="text-xs font-semibold text-[#141413]">{addr.label}</p>
                      <p className="text-xs text-[#52504B] mt-1">{addr.streetAddress}</p>
                      <p className="text-xs text-[#6B6860]">
                        {addr.city}, {addr.state} — {addr.pinCode}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-5">
              <h2 className="font-editorial text-2xl font-medium text-[#141413]">
                Contact & Shipping Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="chk-name" className="block text-xs font-medium text-[#141413] mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="chk-name"
                    type="text"
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="w-full bg-[#FAF9F6] border border-[#D8D3C8] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#141413]"
                  />
                  {errors.customerName && <p className="text-xs text-red-700 mt-1">{errors.customerName}</p>}
                </div>

                <div>
                  <label htmlFor="chk-phone" className="block text-xs font-medium text-[#141413] mb-1.5">
                    Mobile Number
                  </label>
                  <input
                    id="chk-phone"
                    type="tel"
                    placeholder="9876543210"
                    value={form.customerPhone}
                    onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                    className="w-full bg-[#FAF9F6] border border-[#D8D3C8] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#141413]"
                  />
                  {errors.customerPhone && <p className="text-xs text-red-700 mt-1">{errors.customerPhone}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="chk-email" className="block text-xs font-medium text-[#141413] mb-1.5">
                  Email Address
                </label>
                <input
                  id="chk-email"
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                  className="w-full bg-[#FAF9F6] border border-[#D8D3C8] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#141413]"
                />
                {errors.customerEmail && <p className="text-xs text-red-700 mt-1">{errors.customerEmail}</p>}
              </div>

              <div>
                <label htmlFor="chk-address" className="block text-xs font-medium text-[#141413] mb-1.5">
                  Delivery Street Address
                </label>
                <input
                  id="chk-address"
                  type="text"
                  placeholder="House/Flat No., Building, Street, Locality"
                  value={form.shippingAddress}
                  onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })}
                  className="w-full bg-[#FAF9F6] border border-[#D8D3C8] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#141413]"
                />
                {errors.shippingAddress && <p className="text-xs text-red-700 mt-1">{errors.shippingAddress}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="chk-city" className="block text-xs font-medium text-[#141413] mb-1.5">
                    City
                  </label>
                  <input
                    id="chk-city"
                    type="text"
                    value={form.shippingCity}
                    onChange={(e) => setForm({ ...form, shippingCity: e.target.value })}
                    className="w-full bg-[#FAF9F6] border border-[#D8D3C8] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#141413]"
                  />
                  {errors.shippingCity && <p className="text-xs text-red-700 mt-1">{errors.shippingCity}</p>}
                </div>

                <div>
                  <label htmlFor="chk-state" className="block text-xs font-medium text-[#141413] mb-1.5">
                    State
                  </label>
                  <input
                    id="chk-state"
                    type="text"
                    value={form.shippingState}
                    onChange={(e) => setForm({ ...form, shippingState: e.target.value })}
                    className="w-full bg-[#FAF9F6] border border-[#D8D3C8] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#141413]"
                  />
                  {errors.shippingState && <p className="text-xs text-red-700 mt-1">{errors.shippingState}</p>}
                </div>

                <div>
                  <label htmlFor="chk-pin" className="block text-xs font-medium text-[#141413] mb-1.5">
                    PIN Code
                  </label>
                  <input
                    id="chk-pin"
                    type="text"
                    maxLength={6}
                    placeholder="110003"
                    value={form.shippingPinCode}
                    onChange={(e) => setForm({ ...form, shippingPinCode: e.target.value })}
                    className="w-full bg-[#FAF9F6] border border-[#D8D3C8] px-3.5 py-2.5 text-sm tabular-nums focus:outline-none focus:border-[#141413]"
                  />
                  {errors.shippingPinCode && <p className="text-xs text-red-700 mt-1">{errors.shippingPinCode}</p>}
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-[#E5E1D8]">
              <h2 className="font-editorial text-2xl font-medium text-[#141413]">Payment Method</h2>
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-4 border border-[#D8D3C8] bg-[#FAF9F6] cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'razorpay'}
                    onChange={() => setPaymentMethod('razorpay')}
                    className="mt-1 accent-[#141413]"
                  />
                  <div>
                    <p className="text-sm font-medium text-[#141413]">
                      Razorpay Online Payment (UPI, Debit & Credit Cards, Net Banking)
                    </p>
                    <p className="text-xs text-[#6B6860] mt-0.5">
                      Encrypted checkout with server-side HMAC signature verification.
                    </p>
                  </div>
                </label>

                {settings.codEnabled && (
                  <label className="flex items-start gap-3 p-4 border border-[#D8D3C8] bg-[#FAF9F6] cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'cod'}
                      onChange={() => setPaymentMethod('cod')}
                      className="mt-1 accent-[#141413]"
                    />
                    <div>
                      <p className="text-sm font-medium text-[#141413]">Cash on Delivery</p>
                      <p className="text-xs text-[#6B6860] mt-0.5">
                        Pay upon delivery via cash or doorstep UPI.
                      </p>
                    </div>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <aside className="lg:col-span-5 bg-[#F6F4EE] border border-[#E5E1D8] p-6 space-y-5 h-fit">
            <h2 className="font-editorial text-2xl font-medium text-[#141413]">Order Summary</h2>
            <div className="divide-y divide-[#E5E1D8] max-h-72 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.variantId} className="py-3 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-[#141413] truncate">{item.productName}</p>
                    <p className="text-xs text-[#6B6860]">
                      Size {item.size} · {item.colorName} × {item.quantity}
                    </p>
                  </div>
                  <span className="font-medium tabular-nums shrink-0">
                    {formatPaiseToINR(item.sellingPricePaise * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-sm tabular-nums pt-3 border-t border-[#E5E1D8]">
              <div className="flex justify-between text-[#52504B]">
                <span>Subtotal</span>
                <span>{formatPaiseToINR(cartTotals.subtotalPaise)}</span>
              </div>
              {cartTotals.couponDiscountPaise > 0 && (
                <div className="flex justify-between text-[#2E5E4E]">
                  <span>Coupon ({appliedCoupon?.code})</span>
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
                <span>Total Payable</span>
                <span>{formatPaiseToINR(cartTotals.totalPaise)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-[#141413] text-[#FAF9F6] text-xs font-semibold uppercase tracking-wider hover:bg-[#2C2B29] transition-colors disabled:opacity-60"
            >
              {submitting
                ? 'Validating Order...'
                : paymentMethod === 'cod'
                ? 'Place Cash on Delivery Order'
                : 'Continue to Razorpay Payment'}
            </button>
          </aside>
        </form>
      )}
    </main>
  );
}
