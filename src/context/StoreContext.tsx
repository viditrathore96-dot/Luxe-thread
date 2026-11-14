import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { calculateCartTotals, getPrimaryProductImage, type CartTotals } from '../utils/commerce';
import type {
  CartItem,
  Category,
  Coupon,
  Product,
  ProductVariant,
  Profile,
  StoreSettings,
} from '../types/ecommerce';

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Atelier Vanya',
  logoUrl: '',
  contactEmail: 'concierge@ateliervanya.com',
  contactPhone: '+91 11 4089 2210',
  address: '14 Lodhi Colony Institutional Area, New Delhi 110003',
  instagramUrl: 'https://instagram.com/ateliervanya',
  pinterestUrl: 'https://pinterest.com/ateliervanya',
  announcementText: 'Complimentary express shipping across India on orders above ₹15,000',
  heroTitle: 'Architectural Tailoring for Quiet Seasons',
  heroSubtitle: 'Hand-finished Mongolian cashmere, mulberry silk, and Belgian linen crafted in limited runs.',
  heroCtaLabel: 'Explore Collection',
  heroImageUrl: '/src/assets/images/hero_luxury_atelier_1794628724563.jpg',
  shippingFeePaise: 35000,
  freeShippingThresholdPaise: 1500000,
  codEnabled: true,
};

interface ToastMessage {
  id: string;
  text: string;
  tone: 'info' | 'error' | 'success';
}

interface StoreContextValue {
  currentPath: string;
  navigate: (to: string) => void;
  user: Profile | null;
  authLoading: boolean;
  setAuthSession: (user: Profile | null, token?: string) => void;
  logout: () => Promise<void>;
  products: Product[];
  categories: Category[];
  settings: StoreSettings;
  catalogLoading: boolean;
  refreshCatalog: () => Promise<void>;
  cart: CartItem[];
  cartTotals: CartTotals;
  appliedCoupon: Coupon | null;
  setAppliedCoupon: (coupon: Coupon | null) => void;
  addToCart: (product: Product, variant: ProductVariant, quantity: number, openDrawer?: boolean) => boolean;
  updateCartQuantity: (variantId: string, quantity: number) => void;
  removeFromCart: (variantId: string) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  wishlistIds: string[];
  toggleWishlist: (productId: string) => Promise<void>;
  toast: ToastMessage | null;
  showToast: (text: string, tone?: 'info' | 'error' | 'success') => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const CART_STORAGE_KEY = 'av_shopping_bag_v1';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname + window.location.search);
  const [user, setUser] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((text: string, tone: 'info' | 'error' | 'success' = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToast({ id, text, tone });
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 3500);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to === window.location.pathname + window.location.search) return;
    window.history.pushState({}, '', to);
    setCurrentPath(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage quota issues
    }
  }, [cart]);

  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const [configRes, prodRes] = await Promise.all([api.getStoreConfig(), api.getProducts()]);
      setSettings(configRes.settings);
      setCategories(configRes.categories);
      setProducts(prodRes.products);
    } catch {
      // Retain existing state if transient error
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const setAuthSession = useCallback((nextUser: Profile | null, token?: string) => {
    if (token) {
      localStorage.setItem('av_auth_token', token);
    } else if (!nextUser) {
      localStorage.removeItem('av_auth_token');
    }
    setUser(nextUser);
  }, []);

  useEffect(() => {
    void refreshCatalog();
    api
      .getMe()
      .then((res) => {
        setUser(res.user);
        if (res.user) {
          return api.getWishlist().then((w) => setWishlistIds(w.productIds)).catch(() => {});
        }
      })
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, [refreshCatalog]);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    localStorage.removeItem('av_auth_token');
    setUser(null);
    setWishlistIds([]);
    showToast('Signed out of your account.', 'info');
  }, [showToast]);

  const addToCart = useCallback(
    (product: Product, variant: ProductVariant, quantity: number, openDrawer = true): boolean => {
      if (!variant.isActive || variant.stockQuantity <= 0) {
        showToast('This size and colour combination is out of stock.', 'error');
        return false;
      }

      let added = false;
      setCart((prev) => {
        const existing = prev.find((item) => item.variantId === variant.id);
        const currentQty = existing ? existing.quantity : 0;
        const nextQty = currentQty + quantity;
        if (nextQty > variant.stockQuantity) {
          showToast(`Only ${variant.stockQuantity} unit(s) available for ${variant.size} / ${variant.colorName}.`, 'error');
          return prev;
        }
        added = true;
        const primaryImage = getPrimaryProductImage(product);
        if (existing) {
          return prev.map((item) =>
            item.variantId === variant.id
              ? {
                  ...item,
                  quantity: nextQty,
                  maxStock: variant.stockQuantity,
                  originalPricePaise: product.originalPricePaise,
                  sellingPricePaise: product.sellingPricePaise,
                }
              : item
          );
        }
        return [
          ...prev,
          {
            productId: product.id,
            variantId: variant.id,
            productName: product.name,
            slug: product.slug,
            brand: product.brand,
            sku: variant.variantSku,
            size: variant.size,
            colorName: variant.colorName,
            colorHex: variant.colorHex,
            imageUrl: primaryImage,
            originalPricePaise: product.originalPricePaise,
            sellingPricePaise: product.sellingPricePaise,
            quantity,
            maxStock: variant.stockQuantity,
          },
        ];
      });

      if (added) {
        if (openDrawer) {
          setIsCartOpen(true);
        } else {
          showToast(`Added ${product.name} (${variant.size}) to bag.`, 'success');
        }
      }
      return added;
    },
    [showToast]
  );

  const updateCartQuantity = useCallback(
    (variantId: string, quantity: number) => {
      if (quantity <= 0) {
        setCart((prev) => prev.filter((item) => item.variantId !== variantId));
        return;
      }
      setCart((prev) =>
        prev.map((item) => {
          if (item.variantId !== variantId) return item;
          if (quantity > item.maxStock) {
            showToast(`Maximum available stock is ${item.maxStock}.`, 'error');
            return { ...item, quantity: item.maxStock };
          }
          return { ...item, quantity };
        })
      );
    },
    [showToast]
  );

  const removeFromCart = useCallback((variantId: string) => {
    setCart((prev) => prev.filter((item) => item.variantId !== variantId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setAppliedCoupon(null);
  }, []);

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (!user) {
        showToast('Sign in to save pieces to your wishlist.', 'info');
        navigate('/account');
        return;
      }
      try {
        const res = await api.toggleWishlist(productId);
        setWishlistIds(res.productIds);
      } catch (err) {
        showToast((err as Error).message, 'error');
      }
    },
    [user, showToast, navigate]
  );

  const cartTotals = useMemo(
    () => calculateCartTotals(cart, settings, appliedCoupon),
    [cart, settings, appliedCoupon]
  );

  return (
    <StoreContext.Provider
      value={{
        currentPath,
        navigate,
        user,
        authLoading,
        setAuthSession,
        logout,
        products,
        categories,
        settings,
        catalogLoading,
        refreshCatalog,
        cart,
        cartTotals,
        appliedCoupon,
        setAppliedCoupon,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        isSearchOpen,
        setIsSearchOpen,
        wishlistIds,
        toggleWishlist,
        toast,
        showToast,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
