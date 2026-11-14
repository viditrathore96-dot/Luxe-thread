-- 002_rls_policies.sql
-- Strict Row Level Security policies for Atelier Vanya & Supabase Storage bucket setup

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Profiles: users read/update own non-role fields; admins read all
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- Categories: public read; admin write
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT USING (TRUE);
CREATE POLICY "categories_admin_write" ON public.categories FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Products: public reads published only; admin full access
CREATE POLICY "products_public_read_published" ON public.products
  FOR SELECT USING (is_published = TRUE OR public.is_admin());
CREATE POLICY "products_admin_write" ON public.products
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Product images & variants & inventory: public reads for published products; admin writes
CREATE POLICY "product_images_public_read" ON public.product_images
  FOR SELECT USING (
    public.is_admin() OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.is_published = TRUE)
  );
CREATE POLICY "product_images_admin_write" ON public.product_images
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "product_variants_public_read" ON public.product_variants
  FOR SELECT USING (
    public.is_admin() OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.is_published = TRUE)
  );
CREATE POLICY "product_variants_admin_write" ON public.product_variants
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "inventory_public_read" ON public.inventory
  FOR SELECT USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
      WHERE pv.id = variant_id AND p.is_published = TRUE
    )
  );
CREATE POLICY "inventory_admin_write" ON public.inventory
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Carts & cart_items: own cart only
CREATE POLICY "carts_own" ON public.carts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cart_items_own" ON public.cart_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid())
  );

-- Addresses: own addresses only
CREATE POLICY "addresses_own" ON public.addresses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Orders: users read their own orders; admin reads/updates all; order creation happens via server service_role API
CREATE POLICY "orders_select_own_or_admin" ON public.orders
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "orders_admin_update" ON public.orders
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "order_items_select_own_or_admin" ON public.order_items
  FOR SELECT USING (
    public.is_admin() OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
  );

CREATE POLICY "payments_select_own_or_admin" ON public.payments
  FOR SELECT USING (
    public.is_admin() OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
  );

CREATE POLICY "order_history_select_own_or_admin" ON public.order_status_history
  FOR SELECT USING (
    public.is_admin() OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
  );

-- Store settings: public read; admin write
CREATE POLICY "store_settings_public_read" ON public.store_settings FOR SELECT USING (TRUE);
CREATE POLICY "store_settings_admin_write" ON public.store_settings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Coupons: admin full access; active coupons validated via server API
CREATE POLICY "coupons_admin_only" ON public.coupons FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Wishlists: own items only
CREATE POLICY "wishlists_own" ON public.wishlists
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Product reviews: public read, authenticated insert
CREATE POLICY "reviews_public_read" ON public.product_reviews FOR SELECT USING (TRUE);
CREATE POLICY "reviews_auth_insert" ON public.product_reviews FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Webhook events: service_role only (no public policies)

-- Supabase Storage Bucket for Product Images (Public Read, Admin-Only Write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "product_images_bucket_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "product_images_bucket_admin_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "product_images_bucket_admin_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "product_images_bucket_admin_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images' AND public.is_admin());
