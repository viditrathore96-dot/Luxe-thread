import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { api } from '../lib/api';

export function Footer() {
  const { currentPath, navigate, settings } = useStore();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  if (currentPath.startsWith('/admin')) {
    return null;
  }

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!email.trim()) {
      setMessage({ text: 'Please enter your email address.', isError: true });
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.subscribeNewsletter(email);
      setMessage({
        text: res.alreadySubscribed
          ? 'You are already subscribed to our seasonal dispatches.'
          : 'Thank you for joining the Atelier Vanya private list.',
        isError: false,
      });
      if (!res.alreadySubscribed) setEmail('');
    } catch (err) {
      setMessage({ text: (err as Error).message, isError: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="bg-[#141413] text-[#FAF9F6] border-t border-[#2A2926]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          {/* Brand & Atelier Address */}
          <div className="md:col-span-4 space-y-4">
            <h3 className="font-editorial text-2xl font-medium tracking-tight">{settings.storeName}</h3>
            <p className="text-sm text-[#B8B4AA] leading-relaxed max-w-sm">
              Architectural silhouettes crafted in small batches from natural fibres—Mongolian cashmere, mulberry silk, and Belgian flax.
            </p>
            <div className="text-xs text-[#9C988E] space-y-1 pt-2">
              <p>{settings.address}</p>
              <p>
                {settings.contactEmail} · {settings.contactPhone}
              </p>
            </div>
          </div>

          {/* Storefront Navigation */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-semibold tracking-wider text-[#9C988E] uppercase">Collections</h4>
            <ul className="space-y-2 text-sm text-[#DDD9D0]">
              <li>
                <a
                  href="/shop"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/shop');
                  }}
                  className="hover:text-white transition-colors"
                >
                  All Garments
                </a>
              </li>
              <li>
                <a
                  href="/shop?category=outerwear"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/shop?category=outerwear');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Outerwear
                </a>
              </li>
              <li>
                <a
                  href="/shop?category=shirting"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/shop?category=shirting');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Silk Shirting
                </a>
              </li>
              <li>
                <a
                  href="/shop?category=trousers"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/shop?category=trousers');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Tailored Trousers
                </a>
              </li>
            </ul>
          </div>

          {/* Client Services */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-semibold tracking-wider text-[#9C988E] uppercase">Client Care</h4>
            <ul className="space-y-2 text-sm text-[#DDD9D0]">
              <li>
                <a
                  href="/account"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/account');
                  }}
                  className="hover:text-white transition-colors"
                >
                  My Account & Orders
                </a>
              </li>
              <li>
                <a
                  href="/cart"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/cart');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Shopping Bag
                </a>
              </li>
              <li>
                <a
                  href="/admin"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/admin');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Store Admin
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="md:col-span-4 space-y-4">
            <h4 className="text-xs font-semibold tracking-wider text-[#9C988E] uppercase">Private Dispatches</h4>
            <p className="text-sm text-[#B8B4AA]">
              Receive seasonal lookbooks and early access to numbered atelier releases.
            </p>
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2">
              <label htmlFor="footer-newsletter" className="sr-only">
                Email address for newsletter
              </label>
              <input
                id="footer-newsletter"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="flex-1 bg-[#1E1E1C] border border-[#353430] px-3.5 py-2.5 text-sm text-[#FAF9F6] placeholder:text-[#7E7B73] focus:outline-none focus:border-[#FAF9F6]"
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-[#FAF9F6] text-[#141413] text-xs font-semibold tracking-wide hover:bg-[#E5E1D8] transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                {submitting ? 'Joining...' : 'Subscribe'}
              </button>
            </form>
            {message && (
              <p className={`text-xs ${message.isError ? 'text-red-300' : 'text-[#D5CBB8]'}`}>
                {message.text}
              </p>
            )}
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-[#2A2926] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8D8980]">
          <p>© {new Date().getFullYear()} {settings.storeName}. All rights reserved.</p>
          <div className="flex items-center gap-6">
            {settings.instagramUrl && (
              <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="hover:text-[#FAF9F6]">
                Instagram
              </a>
            )}
            {settings.pinterestUrl && (
              <a href={settings.pinterestUrl} target="_blank" rel="noreferrer" className="hover:text-[#FAF9F6]">
                Pinterest
              </a>
            )}
            <span>Payments secured by Razorpay</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
