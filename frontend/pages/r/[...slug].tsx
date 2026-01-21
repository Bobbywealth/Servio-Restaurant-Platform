import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  MapPin,
  Clock,
  ShoppingCart,
  Plus,
  Minus,
  AlertTriangle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  is_available: boolean;
  category_name: string;
  images?: string[];
}

interface RestaurantInfo {
  id?: string;
  name: string;
  slug?: string;
  logoUrl?: string | null;
  settings: any;
}

interface CartItem extends MenuItem {
  quantity: number;
}

export default function PublicProfile() {
  const router = useRouter();
  const { slug } = router.query;
  const restaurantSlug = Array.isArray(slug) ? slug[0] : slug;

  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState<string | null>(null);

  const resolveAssetUrl = (url: string | null | undefined) => {
    if (!url) return undefined
    if (/^https?:\/\//i.test(url)) return url
    const base = String((api as any)?.defaults?.baseURL || '').replace(/\/+$/, '')
    if (!base) return url
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`
  }

  useEffect(() => {
    if (!restaurantSlug) return;

    const fetchData = async () => {
      try {
        const resp = await api.get(`/api/menu/public/${restaurantSlug}`);
        setRestaurant(resp.data.data.restaurant);
        setItems(resp.data.data.items);
      } catch (err: any) {
        setError('Restaurant not found');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [restaurantSlug]);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success('Added to cart');
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.id !== itemId);
    });
  };

  const cartTotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      const resp = await api.post(`/api/orders/public/${restaurantSlug}`, {
        items: cart.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
        customerName: "Guest", // v1 simplicity
      });
      setOrderComplete(resp.data.data.orderId);
      setCart([]);
      setIsCartOpen(false);
    } catch (err) {
      toast.error('Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  if (error || !restaurant) return <div className="min-h-screen flex items-center justify-center font-bold text-red-600">{error || 'Restaurant not found'}</div>;

  if (orderComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
        <h1 className="text-3xl font-bold mb-2">Order Placed!</h1>
        <p className="text-gray-600 mb-6">Your order number is <span className="font-mono font-bold text-blue-600">{orderComplete}</span></p>
        <button onClick={() => setOrderComplete(null)} className="btn-primary">Place Another Order</button>
      </div>
    );
  }

  const menuSettings = restaurant?.settings?.menu || {}
  const heading = String(menuSettings.heading || '').trim() || restaurant.name
  const subheading = String(menuSettings.subheading || '').trim()
  const showLogo = menuSettings.showLogo !== false
  const logoUrl = resolveAssetUrl(restaurant?.logoUrl)
  const shareUrl =
    typeof window !== 'undefined' && restaurantSlug
      ? `${window.location.origin}/r/${restaurantSlug}`
      : ''

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Head>
        <title>{heading} - Menu</title>
      </Head>

      <div className="bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white shadow-sm border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="flex items-start gap-4">
            {showLogo && logoUrl && (
              <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center">
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-4xl font-extrabold tracking-tight">{heading}</h1>
              {subheading && <p className="mt-2 text-white/80">{subheading}</p>}
              <div className="flex flex-wrap gap-4 mt-4 text-sm text-white/70">
                <span className="flex items-center"><Clock className="w-4 h-4 mr-1" /> Fast pickup ordering</span>
                <span className="flex items-center"><MapPin className="w-4 h-4 mr-1" /> {restaurantSlug}</span>
              </div>
              {shareUrl && (
                <div className="mt-4 text-xs text-white/60">
                  Menu URL: <span className="font-mono text-white/80">{shareUrl}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8">
          {Array.from(new Set(items.map(i => i.category_name))).map(cat => (
            <div key={cat}>
              <h2 className="text-xl font-bold mb-4 border-b pb-2">{cat}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.filter(i => i.category_name === cat).map(item => (
                  <div key={item.id} className="bg-white rounded-2xl border border-gray-200 hover:shadow-lg transition-all overflow-hidden">
                    <div className="flex gap-4 p-4">
                      <div className="w-24 h-24 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                        {item.images?.[0] ? (
                          <img src={resolveAssetUrl(item.images[0])} alt={item.name} className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-extrabold text-lg text-gray-900 truncate">{item.name}</h3>
                          <div className="font-extrabold text-blue-600 shrink-0">${item.price.toFixed(2)}</div>
                        </div>
                        <p className="text-gray-600 text-sm mt-1 line-clamp-2">{item.description}</p>
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={() => addToCart(item)}
                            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                          >
                            <Plus className="w-5 h-5" />
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg z-50">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center">
              <div className="relative mr-4">
                <ShoppingCart className="w-8 h-8 text-blue-600" />
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
              </div>
              <div className="font-bold text-lg">${cartTotal.toFixed(2)}</div>
            </div>
            <button 
              onClick={() => setIsCartOpen(true)}
              className="btn-primary px-8"
            >
              View Cart
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[60]" 
              onClick={() => setIsCartOpen(false)} 
            />
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[70] p-6 max-h-[80vh] overflow-y-auto"
            >
              <div className="max-w-xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Your Order</h2>
                  <button onClick={() => setIsCartOpen(false)} className="text-gray-400 font-bold">Close</button>
                </div>
                
                <div className="space-y-4 mb-8">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-sm text-gray-500">${item.price.toFixed(2)}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => removeFromCart(item.id)} className="p-1 rounded bg-gray-100"><Minus className="w-4 h-4" /></button>
                        <span className="font-bold">{item.quantity}</span>
                        <button onClick={() => addToCart(item)} className="p-1 rounded bg-gray-100"><Plus className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4 mb-8">
                  <div className="flex justify-between items-center text-xl font-bold">
                    <span>Total</span>
                    <span>${cartTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-green-800 text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Pay when you arrive - Cash or Card accepted
                    </div>
                  </div>
                  
                  <button 
                    disabled={isSubmitting}
                    onClick={handleCheckout}
                    className="w-full btn-primary py-4 text-lg flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : 'Confirm Order'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
