-- 003_seed_data.sql
-- Initial seed data for Atelier Vanya categories, store settings, and promotional coupons

INSERT INTO public.store_settings (
  store_name, contact_email, contact_phone, address,
  announcement_text, hero_title, hero_subtitle, hero_cta_label,
  shipping_fee_paise, free_shipping_threshold_paise, cod_enabled
)
VALUES (
  'Atelier Vanya',
  'concierge@ateliervanya.com',
  '+91 11 4089 2210',
  '14 Lodhi Colony Institutional Area, New Delhi 110003',
  'Complimentary express shipping across India on orders above ₹15,000',
  'Architectural Tailoring for Quiet Seasons',
  'Hand-finished cashmere, mulberry silk, and Belgian linen crafted in limited runs.',
  'Explore Collection',
  35000,
  1500000,
  TRUE
)
ON CONFLICT DO NOTHING;

INSERT INTO public.categories (name, slug, description, display_order) VALUES
  ('Outerwear', 'outerwear', 'Double-faced cashmere coats, tailored blazers, and weather-proofed gabardine.', 1),
  ('Shirting', 'shirting', 'Mulberry silk and high-twist organic cotton shirting.', 2),
  ('Trousers', 'trousers', 'Pleated wide-leg Belgian linen and virgin wool tailoring.', 3),
  ('Knitwear', 'knitwear', 'Fine-gauge merino wool and brushed cashmere knits.', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.coupons (code, discount_type, discount_value, min_order_paise, is_active) VALUES
  ('VANYA10', 'percent', 10, 500000, TRUE),
  ('ATELIER500', 'fixed', 50000, 1000000, TRUE)
ON CONFLICT (code) DO NOTHING;
