import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';

export function HomePage() {
  const { products, categories, settings, navigate, catalogLoading } = useStore();
  const [showcaseTab, setShowcaseTab] = useState<'new' | 'featured' | 'bestsellers'>('new');

  const showcasedProducts = useMemo(() => {
    if (showcaseTab === 'new') {
      const arrivals = products.filter((p) => p.isNewArrival);
      return (arrivals.length >= 3 ? arrivals : products).slice(0, 3);
    }
    if (showcaseTab === 'featured') {
      const featured = products.filter((p) => p.isFeatured);
      return (featured.length >= 3 ? featured : products).slice(0, 3);
    }
    return [...products].sort((a, b) => b.popularityScore - a.popularityScore).slice(0, 3);
  }, [products, showcaseTab]);

  return (
    <main>
      {/* Section 1: Editorial Hero Campaign */}
      <section className="relative bg-[#141413] text-[#FAF9F6] overflow-hidden">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 items-stretch min-h-[540px] lg:min-h-[620px]">
          <div className="lg:col-span-5 flex flex-col justify-center px-6 sm:px-10 lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))] lg:pr-10 py-14 lg:py-20 z-10">
            <p className="text-xs tracking-[0.2em] uppercase text-[#C8C3B8] mb-4">
              Autumn / Winter Collection
            </p>
            <h1
              className="font-editorial text-4xl sm:text-5xl lg:text-[3.5rem] font-medium leading-[1.08] tracking-tight mb-6"
              style={{ textWrap: 'balance' }}
            >
              {settings.heroTitle}
            </h1>
            <p className="text-base text-[#D3CFC6] leading-relaxed mb-8 max-w-md">
              {settings.heroSubtitle}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href="/shop"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/shop');
                }}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-[#FAF9F6] text-[#141413] text-xs font-semibold tracking-wider uppercase hover:bg-[#E5E1D8] transition-colors whitespace-nowrap"
              >
                <span>{settings.heroCtaLabel || 'Explore Collection'}</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="/shop?category=outerwear"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/shop?category=outerwear');
                }}
                className="text-xs font-medium tracking-wider uppercase text-[#FAF9F6] border-b border-[#FAF9F6]/50 pb-1 hover:border-[#FAF9F6] transition-colors whitespace-nowrap"
              >
                View Outerwear
              </a>
            </div>
          </div>

          <div className="lg:col-span-7 relative min-h-[340px] lg:min-h-full">
            <img
              src={settings.heroImageUrl || '/src/assets/images/hero_luxury_atelier_1794628724563.jpg'}
              alt="Atelier Vanya luxury fashion showroom"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover lg:absolute lg:inset-0"
            />
            <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-[#141413]/75 via-[#141413]/20 to-transparent pointer-events-none" />
          </div>
        </div>
      </section>

      {/* Section 2: Curated Product Showcase (New Arrivals / Featured / Best Sellers) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-8 border-b border-[#E5E1D8]">
          <div>
            <p className="text-xs text-[#6B6860] tracking-wider uppercase mb-2">Curated Wardrobe</p>
            <h2 className="font-editorial text-3xl sm:text-4xl font-medium text-[#141413]">
              Seasonal Editions
            </h2>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#EFECE5] self-start sm:self-auto">
            {[
              { id: 'new', label: 'New Arrivals' },
              { id: 'featured', label: 'Featured' },
              { id: 'bestsellers', label: 'Best Sellers' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setShowcaseTab(tab.id as 'new' | 'featured' | 'bestsellers')}
                className={`px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  showcaseTab === tab.id
                    ? 'bg-[#FAF9F6] text-[#141413] shadow-xs'
                    : 'text-[#6B6860] hover:text-[#141413]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {catalogLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pt-10">
            {[1, 2, 3].map((n) => (
              <div key={n} className="space-y-3 animate-pulse">
                <div className="aspect-[3/4] bg-[#EAE6DD]" />
                <div className="h-3 w-1/3 bg-[#EAE6DD]" />
                <div className="h-4 w-2/3 bg-[#EAE6DD]" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 pt-10">
            {showcasedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <a
            href="/shop"
            onClick={(e) => {
              e.preventDefault();
              navigate('/shop');
            }}
            className="inline-flex items-center gap-2 px-7 py-3.5 border border-[#141413] text-xs font-semibold uppercase tracking-wider text-[#141413] hover:bg-[#141413] hover:text-[#FAF9F6] transition-colors"
          >
            <span>View All Garments</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Section 3: Categories & Atelier Craftsmanship */}
      <section className="bg-[#F3F0E8] border-t border-[#E5E1D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 overflow-hidden bg-[#EAE6DD]">
              <img
                src="/src/assets/images/collection_banner_craft_1794628712239.jpg"
                alt="Raw linen and cashmere bolts on atelier tailoring table"
                referrerPolicy="no-referrer"
                className="w-full aspect-[16/9] object-cover"
              />
            </div>
            <div className="lg:col-span-5 space-y-5">
              <p className="text-xs tracking-[0.18em] uppercase text-[#6B6860]">
                Material Provenance
              </p>
              <h2 className="font-editorial text-3xl sm:text-4xl font-medium text-[#141413] leading-tight">
                Natural Fibres, Cut Without Compromise
              </h2>
              <p className="text-sm text-[#52504B] leading-relaxed">
                Every garment begins at the loom—620gsm Mongolian cashmere, Grade-6A mulberry silk, and unbleached Belgian flax tailored in numbered runs at our New Delhi workshop.
              </p>
              <div className="pt-2">
                <a
                  href="/shop"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/shop');
                  }}
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#141413] border-b border-[#141413] pb-1 hover:opacity-70 transition-opacity"
                >
                  <span>Discover the Archive</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t border-[#DFDBD0]">
            {categories.map((cat) => (
              <a
                key={cat.id}
                href={`/shop?category=${cat.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/shop?category=${cat.slug}`);
                }}
                className="group p-6 bg-[#FAF9F6] border border-[#E5E1D8] hover:border-[#141413] transition-colors flex flex-col justify-between min-h-[140px]"
              >
                <div>
                  <h3 className="font-editorial text-2xl font-medium text-[#141413] mb-2">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-[#6B6860] leading-relaxed">{cat.description}</p>
                </div>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[#141413] group-hover:translate-x-1 transition-transform">
                  Explore <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
