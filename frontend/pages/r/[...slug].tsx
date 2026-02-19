import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Loader2, WifiOff, ServerCrash, SearchX, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import {
  OrderConfirmation,
  HeroSection,
  InfoBar,
  SearchFilterBar,
  MobileCategoryNav,
  StickyNav,
  CategorySidebar,
  MenuGrid,
  FloatingCartBar,
  CartModal,
  ItemDetailModal,
  useCart,
  useMenu,
} from '../../components/order';
import type { MenuItem, ItemSize, SelectedModifier } from '../../components/order';

export default function PublicProfile() {
  const router = useRouter();
  const { slug } = router.query;
  const restaurantSlug = Array.isArray(slug) ? slug[0] : slug;

  const menu = useMenu(restaurantSlug);
  const cart = useCart(restaurantSlug);

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [showStickyNav, setShowStickyNav] = useState(false);

  // Scroll listener for sticky navigation
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyNav(window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Poll order status
  useEffect(() => {
    if (!cart.orderComplete) return;
    const poll = async () => {
      try {
        const resp = await api.get(`/api/orders/public/order/${cart.orderComplete}`);
        const data = resp.data?.data;
        if (data?.status) cart.setOrderStatus(data.status);
        if (data?.pickup_time) cart.setPickupTime(data.pickup_time);
      } catch {
        // ignore polling errors
      }
    };
    poll();
    const t = window.setInterval(poll, 15000);
    return () => window.clearInterval(t);
  }, [cart.orderComplete]);

  const handleAddToCart = (item: MenuItem, size: ItemSize | null, modifiers: Record<string, SelectedModifier[]>) => {
    return cart.addToCart(item, size, modifiers);
  };

  if (menu.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (menu.error || !menu.restaurant) {
    const errorCode = menu.errorState?.code || 'unknown';

    const errorConfig: Record<string, { icon: React.ReactNode; title: string; description: string; showRetry: boolean }> = {
      restaurant_not_found: {
        icon: <SearchX className="h-12 w-12 text-slate-400" />,
        title: 'Restaurant not found',
        description: 'This restaurant page may have moved or the link may be incorrect. Please check the URL and try again.',
        showRetry: false,
      },
      restaurant_unavailable: {
        icon: <ServerCrash className="h-12 w-12 text-orange-400" />,
        title: 'Temporarily unavailable',
        description: 'This restaurant\'s menu is temporarily unavailable. This is usually resolved quickly — please try again.',
        showRetry: true,
      },
      connection_issue: {
        icon: <WifiOff className="h-12 w-12 text-blue-400" />,
        title: 'Connection problem',
        description: 'Unable to reach the server. Please check your internet connection and try again.',
        showRetry: true,
      },
      unknown: {
        icon: <AlertTriangle className="h-12 w-12 text-amber-400" />,
        title: 'Something went wrong',
        description: 'An unexpected error occurred while loading the menu. Please try again.',
        showRetry: true,
      },
    };

    const config = errorConfig[errorCode] || errorConfig.unknown;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4 text-center bg-gradient-to-b from-slate-50 to-white">
        <div className="rounded-full bg-slate-100 p-4">
          {config.icon}
        </div>
        <div className="space-y-2 max-w-sm">
          <h1 className="text-xl font-bold text-slate-800">{config.title}</h1>
          <p className="text-sm text-slate-500 leading-relaxed">{config.description}</p>
        </div>
        {config.showRetry && (
          <button
            type="button"
            onClick={menu.retryFetch}
            className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:bg-blue-800"
          >
            Try again
          </button>
        )}
        {errorCode === 'restaurant_not_found' && (
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Go to homepage
          </button>
        )}
      </div>
    );
  }

  if (cart.orderComplete) {
    return (
      <OrderConfirmation
        orderId={cart.orderComplete}
        orderStatus={cart.orderStatus}
        pickupTime={cart.pickupTime}
        onNewOrder={() => cart.setOrderComplete(null)}
      />
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-slate-50 to-white"
      style={{ paddingBottom: cart.cart.length > 0 ? 'calc(5rem + env(safe-area-inset-bottom, 0px))' : '1.5rem' }}
    >
      <Head>
        <title>{menu.restaurant.name} - Online Ordering</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#1e293b" />
      </Head>

      <HeroSection restaurant={menu.restaurant} />

      <InfoBar restaurant={menu.restaurant} />

      <SearchFilterBar
        searchQuery={menu.searchQuery}
        onSearchChange={menu.setSearchQuery}
        activeFilters={menu.activeFilters}
        onToggleFilter={menu.toggleFilter}
        onClearFilters={menu.clearFilters}
        isFilterMenuOpen={isFilterMenuOpen}
        onToggleFilterMenu={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
        filteredItemCount={menu.filteredItems.length}
      />

      <MobileCategoryNav
        categories={menu.categories}
        selectedCategory={menu.selectedCategory}
        isOpen={isFilterMenuOpen}
        onToggle={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
        onCategorySelect={menu.scrollToCategory}
        itemsByCategory={menu.itemsByCategory}
      />

      {showStickyNav && (
        <StickyNav
          categories={menu.categories}
          showAllCategories={menu.showAllCategories}
          onCategorySelect={menu.scrollToCategory}
          onToggleShowAll={() => menu.setShowAllCategories(!menu.showAllCategories)}
        />
      )}

      {/* Menu */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          <CategorySidebar
            categories={menu.categories}
            selectedCategory={menu.selectedCategory}
            onCategorySelect={menu.scrollToCategory}
            itemsByCategory={menu.itemsByCategory}
          />

          <MenuGrid
            visibleCategories={menu.visibleCategories}
            allCategories={menu.categories}
            itemsByCategory={menu.itemsByCategory}
            collapsedCategories={menu.collapsedCategories}
            showAllCategories={menu.showAllCategories}
            visibleCategoryCount={menu.visibleCategoryCount}
            filteredItemCount={menu.filteredItems.length}
            hasActiveSearchOrFilters={Boolean(menu.searchQuery.trim()) || menu.activeFilters.length > 0}
            onToggleCategory={menu.toggleCategory}
            onOpenItem={setSelectedItem}
            onShowMore={menu.handleShowMoreCategories}
            onShowAll={menu.handleShowAllCategories}
            onShowLess={menu.handleShowLessCategories}
            onClearFilters={menu.clearFilters}
          />
        </div>
      </div>

      <FloatingCartBar
        itemCount={cart.cartItemCount}
        total={cart.cartTotal}
        onViewCart={() => cart.setIsCartOpen(true)}
      />

      <CartModal
        isOpen={cart.isCartOpen}
        onClose={() => cart.setIsCartOpen(false)}
        cart={cart.cart}
        cartTotal={cart.cartTotal}
        checkoutStep={cart.checkoutStep}
        setCheckoutStep={cart.setCheckoutStep}
        customerInfo={cart.customerInfo}
        setCustomerInfo={cart.setCustomerInfo}
        marketingConsent={cart.marketingConsent}
        setMarketingConsent={cart.setMarketingConsent}
        paymentMethod={cart.paymentMethod}
        setPaymentMethod={cart.setPaymentMethod}
        onlinePaymentsEnabled={menu.onlinePaymentsEnabled}
        isSubmitting={cart.isSubmitting}
        onRemoveItem={cart.removeFromCart}
        onIncreaseItem={cart.increaseCartItemQuantity}
        onProceedToPayment={cart.handleProceedToPayment}
        onPlaceOrder={cart.handlePlaceOrder}
      />

      <ItemDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
}
