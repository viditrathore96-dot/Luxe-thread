import { useEffect, useState } from 'react';
import { CheckCircle2, PackageCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { api } from '../lib/api';
import { formatPaiseToINR } from '../utils/commerce';
import type { Order } from '../types/ecommerce';

export function OrderConfirmationPage({ orderId }: { orderId: string }) {
  const { navigate } = useStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .getOrderById(orderId)
      .then((res) => setOrder(res.order))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="h-40 bg-[#EAE6DD] animate-pulse" />
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-editorial text-3xl text-[#141413]">Order Not Found</h1>
        <p className="text-sm text-[#6B6860]">{error || 'Unable to locate this order record.'}</p>
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

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-10">
      <div className="bg-[#F6F4EE] border border-[#D8D3C8] p-8 space-y-4">
        <div className="flex items-center gap-3 text-[#2E5E4E]">
          <CheckCircle2 className="w-6 h-6" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Order {order.orderNumber} · {order.orderStatus}
          </span>
        </div>
        <h1 className="font-editorial text-3xl sm:text-4xl font-medium text-[#141413]">
          Thank you, {order.customerName}
        </h1>
        <p className="text-sm text-[#52504B]">
          Order confirmation and fulfillment updates are linked to <strong>{order.customerEmail}</strong>.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#E0DBD0] text-xs">
          <div>
            <p className="text-[#6B6860]">Payment Method</p>
            <p className="font-medium text-[#141413] mt-0.5 uppercase">{order.paymentMethod}</p>
          </div>
          <div>
            <p className="text-[#6B6860]">Payment Status</p>
            <p className="font-medium text-[#141413] mt-0.5 capitalize">{order.paymentStatus}</p>
          </div>
          <div>
            <p className="text-[#6B6860]">Order Total</p>
            <p className="font-medium text-[#141413] mt-0.5 tabular-nums">
              {formatPaiseToINR(order.totalPaise)}
            </p>
          </div>
          <div>
            <p className="text-[#6B6860]">Tracking</p>
            <p className="font-medium text-[#141413] mt-0.5">
              {order.trackingNumber || 'Preparing dispatch'}
            </p>
          </div>
        </div>
      </div>

      {/* Status History Timeline */}
      <section className="space-y-4">
        <h2 className="font-editorial text-2xl font-medium text-[#141413]">Status History</h2>
        <div className="border border-[#E5E1D8] divide-y divide-[#E5E1D8] bg-[#FAF9F6]">
          {order.statusHistory.map((entry) => (
            <div key={entry.id} className="p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <PackageCheck className="w-4 h-4 text-[#141413] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#141413]">{entry.status}</p>
                  <p className="text-xs text-[#6B6860] mt-0.5">{entry.note}</p>
                </div>
              </div>
              <span className="text-xs text-[#88847C] tabular-nums shrink-0">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Items & Shipping */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-7 space-y-4">
          <h2 className="font-editorial text-2xl font-medium text-[#141413]">Ordered Pieces</h2>
          <div className="border border-[#E5E1D8] divide-y divide-[#E5E1D8]">
            {order.items.map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[#141413]">{item.productName}</p>
                  <p className="text-xs text-[#6B6860]">
                    Size {item.size} · {item.colorName} · Qty {item.quantity} · SKU {item.sku}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-[#141413]">
                  {formatPaiseToINR(item.lineTotalPaise)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-5 space-y-4">
          <h2 className="font-editorial text-2xl font-medium text-[#141413]">Delivery Address</h2>
          <div className="border border-[#E5E1D8] p-4 text-sm text-[#52504B] space-y-1">
            <p className="font-medium text-[#141413]">{order.customerName}</p>
            <p>{order.shippingAddress}</p>
            <p>
              {order.shippingCity}, {order.shippingState} — {order.shippingPinCode}
            </p>
            <p className="pt-1 text-xs text-[#6B6860]">Phone: {order.customerPhone}</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="flex-1 py-3 bg-[#141413] text-[#FAF9F6] text-xs font-semibold uppercase tracking-wider"
            >
              Continue Shopping
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="py-3 px-4 border border-[#D8D3C8] text-xs font-medium text-[#141413] hover:border-[#141413]"
            >
              Print Receipt
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
