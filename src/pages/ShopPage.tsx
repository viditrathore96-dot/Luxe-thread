import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { filterAndSortProducts, formatPaiseToINR } from '../utils/commerce';

const SIZES = ['all', 'XS', 'S', 'M', 'L', 'XL'];

export function ShopPage() {
  const { currentPath, products, categories, catalogLoading } = useStore();

  const initialParams = useMemo(() => {
    const queryStr = currentPath.includes('?') ? currentPath.split('?')[1] : '';
    return new URLSearchParams(queryStr);
  }, [currentPath]);

  const [search, setSearch] = useState(initialParams.get('q') || '');
  const [categorySlug, setCategorySlug] = useState(initialParams.get('category') || 'all');
  const [size, setSize] = useState('all');
  const [colorName, setColorName] = useState('all');
  const [maxPricePaise, setMaxPricePaise] = useState<number>(6000000);
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'popular'>('newest');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    const cat = initialParams.get('category');
    const q = initialParams.get('q');
    if (cat) setCategorySlug(cat);
    if (q !== null) setSearch(q);
  }, [initialParams]);

  const availableColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      for (const v of p.variants) {
        if (v.isActive && v.stockQuantity > 0 && !map.has(v.colorName)) {
          map.set(v.colorName, v.colorHex);
        }
      }
    }
    return Array.from(map.entries()).map(([name, hex]) => ({ name, hex }));
  }, [products]);

  const filteredProducts = useMemo(
    () =>
      filterAndSortProducts(products, {
        search,
        categorySlug,
        size,
        colorName,
        maxPricePaise,
        sortBy,
      }),
    [products, search, categorySlug, size, colorName, maxPricePaise, sortBy]
  );

  const resetFilters = () => {
    setSearch('');
    setCategorySlug('all');
    setSize('all');
    setColorName('all');
    setMaxPricePaise(6000000);
    setSortBy('newest');
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="pb-8 border-b border-[#E5E1D8] flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-xs text-[#6B6860] tracking-wider uppercase mb-2">Atelier Archive</p>
          <h1 className="font-editorial text-4xl font-medium text-[#141413]">
            {categorySlug === 'all'
              ? 'All Garments'
              : categories.find((c) => c.slug === categorySlug)?.name || 'Collection'}
          </h1>
          <p className="text-sm text-[#6B6860] mt-1 tabular-nums">
            Showing {filteredProducts.length} curated piece(s)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[#6B6860] absolute left-3 top-1/2 -translate-y-1/2" />
            <label htmlFor="shop-search" className="sr-only">
              Search products
            </label>
            <input
              id="shop-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search garments..."
              className="w-full bg-[#FAF9F6] border border-[#D8D3C8] pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#141413]"
            />
          </div>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            className="lg:hidden flex items-center gap-2 px-3.5 py-2 border border-[#D8D3C8] text-xs font-medium text-[#141413]"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>

          <div>
            <label htmlFor="shop-sort" className="sr-only">
              Sort products
            </label>
            <select
              id="shop-sort"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'newest' | 'price_asc' | 'price_desc' | 'popular')
              }
              className="bg-[#FAF9F6] border border-[#D8D3C8] px-3 py-2 text-sm text-[#141413] focus:outline-none focus:border-[#141413]"
            >
              <option value="newest">Sort: Newest</option>
              <option value="popular">Sort: Popularity</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-8">
        {/* Sidebar Filters */}
        <aside
          className={`lg:col-span-3 space-y-8 ${
            mobileFiltersOpen ? 'block' : 'hidden lg:block'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#141413]">
                Category
              </h2>
              {(categorySlug !== 'all' || size !== 'all' || colorName !== 'all' || search) && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs text-[#6B6860] hover:text-[#141413] underline flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Reset
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setCategorySlug('all')}
                className={`block w-full text-left py-1.5 text-sm transition-colors ${
                  categorySlug === 'all' ? 'font-semibold text-[#141413]' : 'text-[#6B6860] hover:text-[#141413]'
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategorySlug(cat.slug)}
                  className={`block w-full text-left py-1.5 text-sm transition-colors ${
                    categorySlug === cat.slug
                      ? 'font-semibold text-[#141413]'
                      : 'text-[#6B6860] hover:text-[#141413]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-[#EAE6DD]">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#141413] mb-3">
              Size
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={`py-2 text-xs font-medium border transition-colors ${
                    size === s
                      ? 'bg-[#141413] text-[#FAF9F6] border-[#141413]'
                      : 'bg-transparent text-[#141413] border-[#D8D3C8] hover:border-[#141413]'
                  }`}
                >
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-[#EAE6DD]">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#141413] mb-3">
              Colour
            </h2>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setColorName('all')}
                className={`block text-xs ${
                  colorName === 'all' ? 'font-semibold text-[#141413]' : 'text-[#6B6860]'
                }`}
              >
                All Colours
              </button>
              <div className="flex flex-wrap gap-2">
                {availableColors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setColorName(colorName === c.name ? 'all' : c.name)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border transition-colors ${
                      colorName === c.name
                        ? 'border-[#141413] bg-[#F3F0E8] font-medium'
                        : 'border-[#D8D3C8] hover:border-[#141413]'
                    }`}
                  >
                    <span
                      className="w-3 h-3 border border-black/15 shrink-0"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#EAE6DD]">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="price-range" className="text-xs font-semibold uppercase tracking-wider text-[#141413]">
                Max Price
              </label>
              <span className="text-xs font-medium tabular-nums text-[#141413]">
                {formatPaiseToINR(maxPricePaise)}
              </span>
            </div>
            <input
              id="price-range"
              type="range"
              min={500000}
              max={6000000}
              step={100000}
              value={maxPricePaise}
              onChange={(e) => setMaxPricePaise(Number(e.target.value))}
              className="w-full accent-[#141413]"
            />
          </div>
        </aside>

        {/* Product Grid */}
        <div className="lg:col-span-9">
          {catalogLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="space-y-3 animate-pulse">
                  <div className="aspect-[3/4] bg-[#EAE6DD]" />
                  <div className="h-3 w-1/3 bg-[#EAE6DD]" />
                  <div className="h-4 w-2/3 bg-[#EAE6DD]" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-20 text-center border border-[#E5E1D8] bg-[#F6F4EE] px-6 space-y-4">
              <h2 className="font-editorial text-2xl text-[#141413]">No garments found</h2>
              <p className="text-sm text-[#6B6860] max-w-md mx-auto">
                No pieces matched your active filters. Try clearing one or more criteria to explore the full collection.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="px-6 py-2.5 bg-[#141413] text-[#FAF9F6] text-xs font-semibold uppercase tracking-wider"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
