import { StoreProvider, useStore } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { SearchOverlay } from './components/SearchOverlay';
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { AccountPage } from './pages/AccountPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

function AppShell() {
  const { currentPath, toast } = useStore();
  const pathOnly = currentPath.split('?')[0];

  let page = <HomePage />;
  if (pathOnly === '/' || pathOnly === '') {
    page = <HomePage />;
  } else if (pathOnly === '/shop') {
    page = <ShopPage />;
  } else if (pathOnly.startsWith('/product/')) {
    const slug = pathOnly.replace('/product/', '');
    page = <ProductDetailPage slug={slug} />;
  } else if (pathOnly === '/cart') {
    page = <CartPage />;
  } else if (pathOnly === '/checkout') {
    page = <CheckoutPage />;
  } else if (pathOnly.startsWith('/order/')) {
    const id = pathOnly.replace('/order/', '');
    page = <OrderConfirmationPage orderId={id} />;
  } else if (pathOnly === '/account') {
    page = <AccountPage />;
  } else if (pathOnly.startsWith('/admin')) {
    page = <AdminDashboardPage />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1">{page}</div>
      <Footer />
      <CartDrawer />
      <SearchOverlay />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 text-xs font-medium shadow-lg border whitespace-nowrap ${
            toast.tone === 'error'
              ? 'bg-red-900 text-white border-red-700'
              : 'bg-[#141413] text-[#FAF9F6] border-[#353430]'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  );
}
