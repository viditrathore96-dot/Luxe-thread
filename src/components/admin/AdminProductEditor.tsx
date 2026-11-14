import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Star, Trash2, Upload, X } from 'lucide-react';
import { api } from '../../lib/api';
import type { Category, Product } from '../../types/ecommerce';

interface EditorImage {
  id?: string;
  imageUrl: string;
  altText: string;
  isPrimary: boolean;
  sortOrder: number;
}

interface EditorVariant {
  id?: string;
  size: string;
  colorName: string;
  colorHex: string;
  variantSku: string;
  stockQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
}

export function AdminProductEditor({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(product?.name || '');
  const [slug, setSlug] = useState(product?.slug || '');
  const [brand, setBrand] = useState(product?.brand || 'Atelier Vanya');
  const [categoryId, setCategoryId] = useState(product?.categoryId || categories[0]?.id || '');
  const [sku, setSku] = useState(product?.sku || '');
  const [description, setDescription] = useState(product?.description || '');
  const [fabricCare, setFabricCare] = useState(product?.fabricCare || '');
  const [originalRupees, setOriginalRupees] = useState(
    product ? String(product.originalPricePaise / 100) : '15000'
  );
  const [sellingRupees, setSellingRupees] = useState(
    product ? String(product.sellingPricePaise / 100) : '12500'
  );
  const [isPublished, setIsPublished] = useState(product?.isPublished ?? true);
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [isNewArrival, setIsNewArrival] = useState(product?.isNewArrival ?? true);

  const [images, setImages] = useState<EditorImage[]>(
    product?.images?.map((i) => ({
      id: i.id,
      imageUrl: i.imageUrl,
      altText: i.altText,
      isPrimary: i.isPrimary,
      sortOrder: i.sortOrder,
    })) || []
  );

  const [variants, setVariants] = useState<EditorVariant[]>(
    product?.variants?.map((v) => ({
      id: v.id,
      size: v.size,
      colorName: v.colorName,
      colorHex: v.colorHex,
      variantSku: v.variantSku,
      stockQuantity: v.stockQuantity,
      lowStockThreshold: v.lowStockThreshold,
      isActive: v.isActive,
    })) || [
      {
        size: 'M',
        colorName: 'Ivory',
        colorHex: '#EDE8DC',
        variantSku: '',
        stockQuantity: 5,
        lowStockThreshold: 3,
        isActive: true,
      },
    ]
  );

  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    setError('');

    try {
      for (const file of files) {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Failed to read image file.'));
          reader.readAsDataURL(file);
        });
        const res = await api.adminUploadImage({
          fileName: file.name,
          mimeType: file.type,
          base64Data,
        });
        setImages((prev) => [
          ...prev,
          {
            imageUrl: res.imageUrl,
            altText: name || file.name,
            isPrimary: prev.length === 0,
            sortOrder: prev.length,
          },
        ]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleAddImageUrl = () => {
    if (!urlInput.trim()) return;
    setImages((prev) => [
      ...prev,
      {
        imageUrl: urlInput.trim(),
        altText: name || 'Product image',
        isPrimary: prev.length === 0,
        sortOrder: prev.length,
      },
    ]);
    setUrlInput('');
  };

  const moveImage = (index: number, dir: -1 | 1) => {
    const nextIdx = index + dir;
    if (nextIdx < 0 || nextIdx >= images.length) return;
    const copy = [...images];
    const [moved] = copy.splice(index, 1);
    copy.splice(nextIdx, 0, moved);
    setImages(copy.map((img, i) => ({ ...img, sortOrder: i })));
  };

  const setPrimaryImage = (index: number) => {
    setImages((prev) => prev.map((img, i) => ({ ...img, isPrimary: i === index })));
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((i) => i.isPrimary)) {
        next[0].isPrimary = true;
      }
      return next.map((img, i) => ({ ...img, sortOrder: i }));
    });
  };

  const addVariantRow = () => {
    setVariants((prev) => [
      ...prev,
      {
        size: 'L',
        colorName: 'Obsidian',
        colorHex: '#181817',
        variantSku: sku ? `${sku}-L-${prev.length + 1}` : '',
        stockQuantity: 4,
        lowStockThreshold: 3,
        isActive: true,
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !sku.trim() || !categoryId) {
      setError('Product name, SKU, and category are required.');
      return;
    }

    const origPaise = Math.round(Number(originalRupees) * 100);
    const sellPaise = Math.round(Number(sellingRupees) * 100);
    if (!Number.isFinite(origPaise) || !Number.isFinite(sellPaise) || sellPaise < 0 || origPaise < sellPaise) {
      setError('Original price must be greater than or equal to selling price.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        slug,
        brand,
        categoryId,
        sku,
        description,
        fabricCare,
        originalPricePaise: origPaise,
        sellingPricePaise: sellPaise,
        isPublished,
        isFeatured,
        isNewArrival,
        images,
        variants: variants.map((v, idx) => ({
          ...v,
          variantSku: v.variantSku.trim() || `${sku.trim()}-${v.size}-${idx + 1}`,
        })),
      };

      if (product) {
        await api.adminUpdateProduct(product.id, payload);
      } else {
        await api.adminCreateProduct(payload);
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={product ? 'Edit product' : 'Create product'}>
      <div className="bg-white border border-neutral-200 w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">
            {product ? `Edit Product — ${product.name}` : 'Add New Product'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product editor"
            className="p-1.5 text-neutral-500 hover:text-neutral-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pe-name" className="block text-xs font-medium text-neutral-700 mb-1">
                Product Name
              </label>
              <input
                id="pe-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="pe-slug" className="block text-xs font-medium text-neutral-700 mb-1">
                URL Slug (optional)
              </label>
              <input
                id="pe-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto-generated-from-name"
                className="w-full border border-neutral-300 px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label htmlFor="pe-brand" className="block text-xs font-medium text-neutral-700 mb-1">
                Brand Name
              </label>
              <input
                id="pe-brand"
                type="text"
                required
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="pe-cat" className="block text-xs font-medium text-neutral-700 mb-1">
                Category
              </label>
              <select
                id="pe-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full border border-neutral-300 px-3 py-2 text-sm bg-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pe-sku" className="block text-xs font-medium text-neutral-700 mb-1">
                Master SKU
              </label>
              <input
                id="pe-sku"
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="AV-OUT-099"
                className="w-full border border-neutral-300 px-3 py-2 text-sm font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pe-orig" className="block text-xs font-medium text-neutral-700 mb-1">
                  Original Price (INR)
                </label>
                <input
                  id="pe-orig"
                  type="number"
                  min={0}
                  required
                  value={originalRupees}
                  onChange={(e) => setOriginalRupees(e.target.value)}
                  className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="pe-sell" className="block text-xs font-medium text-neutral-700 mb-1">
                  Selling Price (INR)
                </label>
                <input
                  id="pe-sell"
                  type="number"
                  min={0}
                  required
                  value={sellingRupees}
                  onChange={(e) => setSellingRupees(e.target.value)}
                  className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="pe-desc" className="block text-xs font-medium text-neutral-700 mb-1">
              Description
            </label>
            <textarea
              id="pe-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="pe-care" className="block text-xs font-medium text-neutral-700 mb-1">
              Composition & Care
            </label>
            <input
              id="pe-care"
              type="text"
              value={fabricCare}
              onChange={(e) => setFabricCare(e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-6 py-2">
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-800">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="accent-neutral-900"
              />
              Published on Storefront
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-800">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="accent-neutral-900"
              />
              Featured Collection
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-800">
              <input
                type="checkbox"
                checked={isNewArrival}
                onChange={(e) => setIsNewArrival(e.target.checked)}
                className="accent-neutral-900"
              />
              New Arrival
            </label>
          </div>

          {/* Multi-Image Manager */}
          <div className="border-t border-neutral-200 pt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Product Images</h3>
                <p className="text-xs text-neutral-500">
                  Upload images (Supabase Storage when configured, or local storage), reorder, or select primary photo.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-neutral-900 text-white text-xs font-medium cursor-pointer hover:bg-neutral-800">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploading ? 'Uploading...' : 'Upload Images'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Or paste an image URL..."
                className="flex-1 border border-neutral-300 px-3 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="px-3 py-1.5 border border-neutral-300 text-xs font-medium hover:border-neutral-900"
              >
                Add URL
              </button>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {images.map((img, idx) => (
                  <div key={`${img.imageUrl}-${idx}`} className="border border-neutral-200 p-2 space-y-2 bg-neutral-50">
                    <div className="aspect-[3/4] bg-neutral-200 overflow-hidden relative">
                      <img
                        src={img.imageUrl}
                        alt={img.altText || 'Preview'}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      {img.isPrimary && (
                        <span className="absolute top-1.5 left-1.5 bg-neutral-900 text-white text-[10px] px-1.5 py-0.5">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => moveImage(idx, -1)}
                        disabled={idx === 0}
                        aria-label="Move image left"
                        className="p-1 text-neutral-600 disabled:opacity-30"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrimaryImage(idx)}
                        aria-label="Set as primary image"
                        className={`p-1 ${img.isPrimary ? 'text-amber-600' : 'text-neutral-500 hover:text-neutral-900'}`}
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(idx, 1)}
                        disabled={idx === images.length - 1}
                        aria-label="Move image right"
                        className="p-1 text-neutral-600 disabled:opacity-30"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        aria-label="Remove image"
                        className="p-1 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Variants Matrix */}
          <div className="border-t border-neutral-200 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">
                Size & Colour Variants ({variants.length})
              </h3>
              <button
                type="button"
                onClick={addVariantRow}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-neutral-300 text-xs font-medium hover:border-neutral-900"
              >
                <Plus className="w-3.5 h-3.5" /> Add Variant
              </button>
            </div>

            <div className="space-y-2">
              {variants.map((v, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center border border-neutral-200 p-2 bg-neutral-50">
                  <input
                    type="text"
                    value={v.size}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, size: e.target.value } : row))
                      )
                    }
                    placeholder="Size"
                    aria-label="Variant size"
                    className="col-span-2 border border-neutral-300 px-2 py-1.5 text-xs bg-white"
                  />
                  <input
                    type="text"
                    value={v.colorName}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, colorName: e.target.value } : row))
                      )
                    }
                    placeholder="Colour"
                    aria-label="Variant colour name"
                    className="col-span-3 border border-neutral-300 px-2 py-1.5 text-xs bg-white"
                  />
                  <input
                    type="color"
                    value={v.colorHex}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, colorHex: e.target.value } : row))
                      )
                    }
                    aria-label="Variant colour swatch"
                    className="col-span-1 h-8 w-full border border-neutral-300 p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={v.variantSku}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, variantSku: e.target.value } : row))
                      )
                    }
                    placeholder="Variant SKU"
                    aria-label="Variant SKU"
                    className="col-span-3 border border-neutral-300 px-2 py-1.5 text-xs font-mono bg-white"
                  />
                  <input
                    type="number"
                    min={0}
                    value={v.stockQuantity}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, stockQuantity: Number(e.target.value) } : row
                        )
                      )
                    }
                    aria-label="Variant stock quantity"
                    className="col-span-2 border border-neutral-300 px-2 py-1.5 text-xs tabular-nums bg-white"
                  />
                  <button
                    type="button"
                    disabled={variants.length <= 1}
                    onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label="Remove variant"
                    className="col-span-1 flex justify-center text-neutral-500 hover:text-red-600 disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-neutral-300 text-xs font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : product ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
