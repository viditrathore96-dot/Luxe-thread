import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  calculateDiscountPercent,
  formatPaiseToINR,
  getPrimaryProductImage,
  getTotalProductStock,
} from '../utils/commerce';
import type { Product } from '../types/ecommerce';

export function ProductCard({ product }: { product: Product }) {
  const { navigate, wishlistIds, toggleWishlist } = useStore();
  const [imgError, setImgError] = useState(false);

  const primaryImage = getPrimaryProductImage(product);
  const secondaryImage = product.images.find((img) => img.imageUrl !== primaryImage)?.imageUrl;
  const totalStock = getTotalProductStock(product);
  const discountPct = calculateDiscountPercent(product.originalPricePaise, product.sellingPricePaise);
  const isWishlisted = wishlistIds.includes(product.id);

  const quietTag =
    totalStock === 0
      ? 'Sold Out'
      : product.isNewArrival
      ? 'New Arrival'
      : discountPct > 0
      ? `${discountPct}% Off`
      : null;

  return (
    <article className="group flex flex-col">
      <div className="relative aspect-[3/4] bg-[#EFECE5] overflow-hidden mb-4">
        <a
          href={`/product/${product.slug}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(`/product/${product.slug}`);
          }}
          className="block w-full h-full"
        >
          {primaryImage && !imgError ? (
            <>
              <img
                src={primaryImage}
                alt={product.name}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              />
              {secondaryImage && (
                <img
                  src={secondaryImage}
                  alt={`${product.name} alternate view`}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#F2EFE8] to-[#E2DDD2] text-[#6E6B64]">
              <span className="font-editorial text-lg">{product.brand}</span>
              <span className="text-xs mt-1">{product.name}</span>
            </div>
          )}
        </a>

        <button
          type="button"
          onClick={() => toggleWishlist(product.id)}
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          className="absolute top-3 right-3 w-9 h-9 bg-[#FAF9F6]/90 backdrop-blur-sm flex items-center justify-center text-[#141413] hover:bg-[#141413] hover:text-[#FAF9F6] transition-colors"
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Zero-pill unboxed metadata */}
      <div className="flex items-center justify-between gap-2 text-xs text-[#6B6860] mb-1">
        <span>
          {product.brand} · {product.categoryName}
        </span>
        {quietTag && <span className="text-[#141413] font-medium">{quietTag}</span>}
      </div>

      <a
        href={`/product/${product.slug}`}
        onClick={(e) => {
          e.preventDefault();
          navigate(`/product/${product.slug}`);
        }}
        className="text-base font-medium text-[#141413] leading-snug hover:underline underline-offset-4 mb-1.5"
      >
        {product.name}
      </a>

      <div className="flex items-baseline gap-2.5 tabular-nums text-sm">
        <span className="font-semibold text-[#141413]">{formatPaiseToINR(product.sellingPricePaise)}</span>
        {discountPct > 0 && (
          <span className="text-[#88847C] line-through text-xs">
            {formatPaiseToINR(product.originalPricePaise)}
          </span>
        )}
      </div>
    </article>
  );
}
