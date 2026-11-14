import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Maximize2, Minus, Plus, Star, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { api } from '../lib/api';
import { ProductCard } from '../components/ProductCard';
import { calculateDiscountPercent, formatPaiseToINR } from '../utils/commerce';
import type { Product } from '../types/ecommerce';

export function ProductDetailPage({ slug }: { slug: string }) {
  const { products, navigate, addToCart, user, showToast } = useStore();
  const [product, setProduct] = useState<Product | null>(
    () => products.find((p) => p.slug === slug) || null
  );
  const [loading, setLoading] = useState(!product);
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState(1);

  // Review state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    const localMatch = products.find((p) => p.slug === slug);
    if (localMatch) {
      setProduct(localMatch);
      setLoading(false);
    } else {
      setLoading(true);
      api
        .getProductBySlug(slug)
        .then((res) => setProduct(res.product))
        .catch(() => setProduct(null))
        .finally(() => setLoading(false));
    }
  }, [slug, products]);

  useEffect(() => {
    if (product) {
      document.title = `${product.name} — Atelier Vanya`;
      const availableVariant =
        product.variants.find((v) => v.isActive && v.stockQuantity > 0) || product.variants[0];
      if (availableVariant) {
        setSelectedColor(availableVariant.colorName);
        setSelectedSize(availableVariant.size);
      }
      setActiveImgIdx(0);
      setQuantity(1);
    }
    return () => {
      document.title = 'Atelier Vanya — Luxury Contemporary Apparel';
    };
  }, [product?.id]);

  const sortedImages = useMemo(() => {
    if (!product) return [];
    return [...product.images].sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return a.sortOrder - b.sortOrder;
    });
  }, [product]);

  const uniqueColors = useMemo(() => {
    if (!product) return [];
    const seen = new Map<string, string>();
    for (const v of product.variants) {
      if (v.isActive && !seen.has(v.colorName)) {
        seen.set(v.colorName, v.colorHex);
      }
    }
    return Array.from(seen.entries()).map(([name, hex]) => ({ name, hex }));
  }, [product]);

  const variantsForColor = useMemo(() => {
    if (!product) return [];
    return product.variants.filter((v) => v.isActive && v.colorName === selectedColor);
  }, [product, selectedColor]);

  const selectedVariant = useMemo(() => {
    return variantsForColor.find((v) => v.size === selectedSize);
  }, [variantsForColor, selectedSize]);

  useEffect(() => {
    if (selectedVariant && quantity > selectedVariant.stockQuantity) {
      setQuantity(Math.max(1, selectedVariant.stockQuantity));
    }
  }, [selectedVariant, quantity]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return products
      .filter((p) => p.id !== product.id && p.isPublished)
      .sort((a, b) => (a.categoryId === product.categoryId ? -1 : b.categoryId === product.categoryId ? 1 : 0))
      .slice(0, 3);
  }, [product, products]);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 animate-pulse">
          <div className="lg:col-span-7 aspect-[3/4] bg-[#EAE6DD]" />
          <div className="lg:col-span-5 space-y-4">
            <div className="h-6 w-1/3 bg-[#EAE6DD]" />
            <div className="h-10 w-3/4 bg-[#EAE6DD]" />
            <div className="h-24 w-full bg-[#EAE6DD]" />
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-24 text-center space-y-4">
        <h1 className="font-editorial text-3xl text-[#141413]">Garment Not Found</h1>
        <p className="text-sm text-[#6B6860]">This piece may have been archived or unpublished.</p>
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

  const discountPct = calculateDiscountPercent(product.originalPricePaise, product.sellingPricePaise);
  const currentImg = sortedImages[activeImgIdx]?.imageUrl || '';
  const inStock = Boolean(selectedVariant && selectedVariant.stockQuantity > 0);

  const handleAddToBag = () => {
    if (!selectedVariant) return;
    addToCart(product, selectedVariant, quantity, true);
  };

  const handleBuyNow = () => {
    if (!selectedVariant) return;
    const ok = addToCart(product, selectedVariant, quantity, false);
    if (ok) navigate('/checkout');
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast('Please sign in to post a review.', 'info');
      navigate('/account');
      return;
    }
    if (!reviewComment.trim()) return;
    setSubmittingReview(true);
    try {
      const res = await api.addReview(product.id, {
        rating: reviewRating,
        comment: reviewComment,
      });
      setProduct((prev) =>
        prev ? { ...prev, reviews: [res.review, ...(prev.reviews || [])] } : prev
      );
      setReviewComment('');
      showToast('Thank you for sharing your review.', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <button
        type="button"
        onClick={() => navigate('/shop')}
        className="inline-flex items-center gap-1.5 text-xs text-[#6B6860] hover:text-[#141413] mb-8"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Collection
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        {/* Left: Image Gallery */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-[3/4] bg-[#EFECE5] overflow-hidden group">
            {currentImg ? (
              <img
                src={currentImg}
                alt={sortedImages[activeImgIdx]?.altText || product.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#6B6860]">
                No image available
              </div>
            )}
            {currentImg && (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label="Enlarge product image"
                className="absolute bottom-4 right-4 p-2.5 bg-[#FAF9F6]/90 text-[#141413] hover:bg-[#141413] hover:text-[#FAF9F6] transition-colors flex items-center gap-1.5 text-xs font-medium"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Zoom</span>
              </button>
            )}
          </div>

          {sortedImages.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {sortedImages.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImgIdx(idx)}
                  aria-label={`View image ${idx + 1}`}
                  className={`aspect-[3/4] bg-[#EFECE5] overflow-hidden border-2 transition-colors ${
                    activeImgIdx === idx ? 'border-[#141413]' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img.imageUrl}
                    alt={img.altText || product.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Contiguous Purchase Module */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
          <div>
            <p className="text-xs text-[#6B6860] uppercase tracking-wider mb-2">
              {product.brand} · {product.categoryName} · SKU {selectedVariant?.variantSku || product.sku}
            </p>
            <h1 className="font-editorial text-3xl sm:text-4xl font-medium text-[#141413] leading-tight">
              {product.name}
            </h1>
          </div>

          <div className="flex items-baseline gap-3 tabular-nums pb-6 border-b border-[#E5E1D8]">
            <span className="text-2xl font-semibold text-[#141413]">
              {formatPaiseToINR(product.sellingPricePaise)}
            </span>
            {discountPct > 0 && (
              <>
                <span className="text-base text-[#88847C] line-through">
                  {formatPaiseToINR(product.originalPricePaise)}
                </span>
                <span className="text-xs font-semibold text-[#2E5E4E]">
                  Save {discountPct}%
                </span>
              </>
            )}
          </div>

          <p className="text-sm text-[#3C3A36] leading-relaxed">{product.description}</p>

          {/* Color Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-[#141413]">Colour</span>
              <span className="text-[#6B6860]">{selectedColor}</span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {uniqueColors.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    setSelectedColor(c.name);
                    const firstValid = product.variants.find(
                      (v) => v.isActive && v.colorName === c.name && v.stockQuantity > 0
                    );
                    if (firstValid) setSelectedSize(firstValid.size);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 text-xs border transition-colors ${
                    selectedColor === c.name
                      ? 'border-[#141413] bg-[#F3F0E8] font-medium'
                      : 'border-[#D8D3C8] hover:border-[#141413]'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 border border-black/15"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Size Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-[#141413]">Size</span>
              {selectedVariant && (
                <span
                  className={`tabular-nums ${
                    selectedVariant.stockQuantity === 0
                      ? 'text-red-700 font-medium'
                      : selectedVariant.stockQuantity <= selectedVariant.lowStockThreshold
                      ? 'text-amber-800 font-medium'
                      : 'text-[#6B6860]'
                  }`}
                >
                  {selectedVariant.stockQuantity === 0
                    ? 'Out of stock'
                    : selectedVariant.stockQuantity <= selectedVariant.lowStockThreshold
                    ? `Only ${selectedVariant.stockQuantity} left in stock`
                    : `${selectedVariant.stockQuantity} in stock`}
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {variantsForColor.map((v) => {
                const disabled = v.stockQuantity <= 0;
                const active = selectedSize === v.size;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedSize(v.size)}
                    className={`py-2.5 text-xs font-medium border transition-colors ${
                      disabled
                        ? 'border-[#EAE6DD] text-[#B5B0A6] bg-[#F6F4EE] line-through cursor-not-allowed'
                        : active
                        ? 'bg-[#141413] text-[#FAF9F6] border-[#141413]'
                        : 'border-[#D8D3C8] text-[#141413] hover:border-[#141413]'
                    }`}
                  >
                    {v.size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity & Actions */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-[#D8D3C8] h-12">
                <button
                  type="button"
                  disabled={!inStock || quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="w-11 h-full flex items-center justify-center text-[#141413] disabled:opacity-40"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-10 text-center text-sm font-medium tabular-nums">{quantity}</span>
                <button
                  type="button"
                  disabled={!inStock || !selectedVariant || quantity >= selectedVariant.stockQuantity}
                  onClick={() =>
                    setQuantity((q) =>
                      selectedVariant ? Math.min(selectedVariant.stockQuantity, q + 1) : q
                    )
                  }
                  aria-label="Increase quantity"
                  className="w-11 h-full flex items-center justify-center text-[#141413] disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                disabled={!inStock}
                onClick={handleAddToBag}
                className="flex-1 h-12 bg-[#141413] text-[#FAF9F6] text-xs font-semibold uppercase tracking-wider hover:bg-[#2C2B29] transition-colors disabled:bg-[#B5B0A6] disabled:cursor-not-allowed"
              >
                {inStock ? 'Add to Bag' : 'Sold Out'}
              </button>
            </div>

            <button
              type="button"
              disabled={!inStock}
              onClick={handleBuyNow}
              className="w-full h-12 border border-[#141413] text-[#141413] text-xs font-semibold uppercase tracking-wider hover:bg-[#F3F0E8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Buy Now
            </button>
          </div>

          {product.fabricCare && (
            <div className="pt-5 border-t border-[#E5E1D8] space-y-1.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#141413]">
                Composition & Care
              </h2>
              <p className="text-xs text-[#6B6860] leading-relaxed">{product.fabricCare}</p>
            </div>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      <section className="mt-20 pt-12 border-t border-[#E5E1D8] grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-4">
          <h2 className="font-editorial text-2xl font-medium text-[#141413]">Client Reviews</h2>
          <p className="text-xs text-[#6B6860]">
            Verified impressions from Atelier Vanya clients.
          </p>
          <form onSubmit={handleSubmitReview} className="space-y-3 pt-2">
            <div>
              <label htmlFor="review-rating" className="block text-xs font-medium text-[#141413] mb-1">
                Rating
              </label>
              <select
                id="review-rating"
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="w-full bg-[#FAF9F6] border border-[#D8D3C8] px-3 py-2 text-sm"
              >
                <option value={5}>5 Stars — Exceptional</option>
                <option value={4}>4 Stars — Very Good</option>
                <option value={3}>3 Stars — Satisfactory</option>
              </select>
            </div>
            <div>
              <label htmlFor="review-comment" className="block text-xs font-medium text-[#141413] mb-1">
                Review
              </label>
              <textarea
                id="review-comment"
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share notes on fit, drape, and fabric feel..."
                className="w-full bg-[#FAF9F6] border border-[#D8D3C8] px-3 py-2 text-sm focus:outline-none focus:border-[#141413]"
              />
            </div>
            <button
              type="submit"
              disabled={submittingReview}
              className="px-5 py-2.5 bg-[#141413] text-[#FAF9F6] text-xs font-semibold uppercase tracking-wider"
            >
              {submittingReview ? 'Posting...' : 'Post Review'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 space-y-6">
          {(product.reviews || []).length === 0 ? (
            <p className="text-sm text-[#6B6860]">No reviews yet for this garment.</p>
          ) : (
            (product.reviews || []).map((rev) => (
              <div key={rev.id} className="pb-6 border-b border-[#EAE6DD]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#141413]">{rev.authorName}</span>
                  <div className="flex items-center gap-0.5 text-[#141413]">
                    {Array.from({ length: rev.rating }).map((_, idx) => (
                      <Star key={idx} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-[#52504B]">{rev.comment}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="mt-20 pt-12 border-t border-[#E5E1D8]">
          <h2 className="font-editorial text-3xl font-medium text-[#141413] mb-8">
            Complete the Wardrobe
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && currentImg && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged product image"
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close enlarged gallery"
            className="absolute top-6 right-6 p-2 bg-white/10 text-white hover:bg-white/20"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={currentImg}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />
        </div>
      )}
    </main>
  );
}
