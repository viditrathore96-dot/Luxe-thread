import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { filterAndSortProducts, formatPaiseToINR, getPrimaryProductImage } from '../utils/commerce';

export function SearchOverlay() {
  const { isSearchOpen, setIsSearchOpen, products, navigate } = useStore();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return products.slice(0, 4);
    return filterAndSortProducts(products, { search: query, sortBy: 'popular' }).slice(0, 6);
  }, [products, query]);

  if (!isSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4" role="dialog" aria-modal="true" aria-label="Search garments">
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
        onClick={() => setIsSearchOpen(false)}
      />
      <div className="relative z-10 w-full max-w-2xl bg-[#FAF9F6] border border-[#E5E1D8] p-6 shadow-xl">
        <div className="flex items-center gap-3 pb-4 border-b border-[#E5E1D8]">
          <Search className="w-5 h-5 text-[#6B6860] shrink-0" />
          <label htmlFor="global-search-input" className="sr-only">
            Search garments
          </label>
          <input
            id="global-search-input"
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cashmere coats, mulberry silk, linen trousers, or SKU..."
            className="flex-1 bg-transparent text-base text-[#141413] placeholder:text-[#8D8980] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setIsSearchOpen(false)}
            aria-label="Close search"
            className="p-1.5 text-[#141413] hover:opacity-70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between text-xs text-[#6B6860]">
            <span>{query.trim() ? `${results.length} matching piece(s)` : 'Featured Pieces'}</span>
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(false);
                navigate(`/shop${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`);
              }}
              className="underline hover:text-[#141413]"
            >
              View all in Shop
            </button>
          </div>

          {results.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#6B6860]">
              No garments matched “{query}”. Try searching by fabric or category.
            </p>
          ) : (
            <div className="divide-y divide-[#EFECE4]">
              {results.map((product) => {
                const img = getPrimaryProductImage(product);
                return (
                  <a
                    key={product.id}
                    href={`/product/${product.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setIsSearchOpen(false);
                      navigate(`/product/${product.slug}`);
                    }}
                    className="flex items-center gap-4 py-3 hover:bg-[#F3F0E8] px-2 transition-colors"
                  >
                    <div className="w-12 h-16 bg-[#EFECE5] shrink-0 overflow-hidden">
                      {img && (
                        <img
                          src={img}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#6B6860]">{product.categoryName}</p>
                      <p className="text-sm font-medium text-[#141413] truncate">{product.name}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-[#141413]">
                      {formatPaiseToINR(product.sellingPricePaise)}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
