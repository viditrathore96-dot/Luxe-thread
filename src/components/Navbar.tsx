import { useState } from 'react';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export function Navbar() {
  const {
    currentPath,
    navigate,
    settings,
    cartTotals,
    setIsCartOpen,
    setIsSearchOpen,
    user,
  } = useStore();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pathOnly = currentPath.split('?')[0];
  if (pathOnly.startsWith('/admin')) {
    return null;
  }

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Shop', href: '/shop' },
    { label: 'Outerwear', href: '/shop?category=outerwear' },
    { label: 'Shirting', href: '/shop?category=shirting' },
    { label: 'Admin', href: '/admin' },
  ];

  const handleLinkClick = (href: string) => {
    setMobileMenuOpen(false);
    navigate(href);
  };

  return (
    <div className="sticky top-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-sm border-b border-[#E5E1D8]">
      {!bannerDismissed && settings.announcementText && (
        <div className="bg-[#141413] text-[#FAF9F6] text-xs py-2 px-4 flex items-center justify-center relative">
          <p className="truncate pr-8 tracking-wide">{settings.announcementText}</p>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss announcement"
            className="absolute right-3 p-1 text-[#FAF9F6]/70 hover:text-[#FAF9F6] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="md:hidden p-2 -ml-2 text-[#141413] hover:opacity-70"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleLinkClick('/');
            }}
            className="font-editorial text-2xl font-semibold tracking-tight text-[#141413] whitespace-nowrap shrink-0 flex items-center gap-2.5"
          >
            {settings.logoUrl && (
              <img
                src={settings.logoUrl}
                alt={settings.storeName}
                referrerPolicy="no-referrer"
                className="w-6 h-6 object-contain"
              />
            )}
            <span>{settings.storeName}</span>
          </a>
        </div>

        {/* Zone 2: Clean Typography Nav Links */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => {
            const active =
              link.href === '/'
                ? pathOnly === '/'
                : currentPath === link.href || (link.href === '/shop' && pathOnly === '/shop' && !currentPath.includes('category='));
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleLinkClick(link.href);
                }}
                className={`text-sm whitespace-nowrap shrink-0 pb-0.5 transition-colors border-b ${
                  active
                    ? 'text-[#141413] border-[#141413] font-medium'
                    : 'text-[#52504B] border-transparent hover:text-[#141413]'
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Search, Account & Shopping Bag */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search catalog"
            className="p-2 text-[#141413] hover:opacity-70 transition-opacity whitespace-nowrap shrink-0"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>

          <a
            href="/account"
            onClick={(e) => {
              e.preventDefault();
              handleLinkClick('/account');
            }}
            aria-label={user ? `Account (${user.fullName})` : 'Account sign in'}
            className="p-2 text-[#141413] hover:opacity-70 transition-opacity flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <User className="w-[18px] h-[18px]" />
            <span className="hidden lg:inline text-xs font-medium">
              {user ? user.fullName.split(' ')[0] : 'Account'}
            </span>
          </a>

          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            aria-label={`Shopping bag with ${cartTotals.itemCount} items`}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#141413] text-[#FAF9F6] text-xs font-medium hover:bg-[#2C2B29] transition-colors whitespace-nowrap shrink-0 tabular-nums"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Bag ({cartTotals.itemCount})</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Panel */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E5E1D8] bg-[#FAF9F6] px-4 py-4 space-y-2">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => {
                e.preventDefault();
                handleLinkClick(link.href);
              }}
              className="block py-2.5 text-sm font-medium text-[#141413] border-b border-[#EFECE4] last:border-b-0"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
