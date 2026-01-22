import React, { useMemo, useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  Phone,
  MapPin,
  Clock,
  ShoppingCart,
  Plus,
  Minus,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Bug,
  Copy as CopyIcon,
  Wand2,
  Zap,
  ExternalLink
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
}

interface RestaurantInfo {
  name: string;
  settings: any;
  logo_url?: string;
  cover_image_url?: string;
  address?: any;
  phone?: string;
  description?: string;
}

interface CartItem extends MenuItem {
  quantity: number;
}

export default function PublicProfile() {
  const router = useRouter();
  const { slug } = router.query;
  const restaurantSlug = Array.isArray(slug) ? slug[0] : slug;
  const testMode = useMemo(() => {
    const q = router.query;
    const v = (q.test || q.debug || '') as string | string[];
    const s = Array.isArray(v) ? v[0] : v;
    return process.env.NODE_ENV !== 'production' && (s === '1' || s === 'true');
  }, [router.query]);

  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('Guest');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderType, setOrderType] = useState<'pickup' | 'delivery'>('pickup');
  const [pickupTime, setPickupTime] = useState<string>('');
  const [lastOrderRequest, setLastOrderRequest] = useState<any>(null);
  const [lastOrderResponse, setLastOrderResponse] = useState<any>(null);

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
      const payload = {
        items: cart.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
        customerName: customerName || 'Guest',
        customerPhone: customerPhone || undefined,
        customerEmail: customerEmail || undefined,
        // The current backend public order endpoint ignores these extra fields,
        // but we include them for future-proofing/testing.
        orderType,
        pickupTime: pickupTime || undefined,
        notes: orderNotes || undefined
      };
      setLastOrderRequest(payload);

      const resp = await api.post(`/api/orders/public/${restaurantSlug}`, payload);
      setLastOrderResponse(resp.data);
      setOrderComplete(resp.data.data.orderId);
      setCart([]);
      setIsCartOpen(false);
      setOrderNotes('');
    } catch (err) {
      toast.error('Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const randomItem = () => {
    const available = items.filter((i) => i.is_available);
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  };

  const addRandomItems = (count: number) => {
    const picked: MenuItem[] = [];
    for (let i = 0; i < count; i++) {
      const it = randomItem();
      if (it) picked.push(it);
    }
    if (picked.length === 0) return;
    setCart((prev) => {
      const next = [...prev];
      for (const it of picked) {
        const existing = next.find((x) => x.id === it.id);
        if (existing) existing.quantity += 1;
        else next.push({ ...it, quantity: 1 });
      }
      return next;
    });
    toast.success(`Added ${picked.length} random item(s)`);
  };

  const copyJson = async (value: any) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const sendTestOrder = async (opts?: { itemsCount?: number; openCart?: boolean }) => {
    const itemsCount = opts?.itemsCount ?? 3;
    const tempCart: CartItem[] = [];
    for (let i = 0; i < itemsCount; i++) {
      const it = randomItem();
      if (!it) continue;
      const existing = tempCart.find((x) => x.id === it.id);
      if (existing) existing.quantity += 1;
      else tempCart.push({ ...it, quantity: 1 });
    }

    if (tempCart.length === 0) {
      toast.error('No available items to order');
      return;
    }

    const payload = {
      items: tempCart.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
      customerName: customerName || 'Guest',
      customerPhone: customerPhone || undefined,
      customerEmail: customerEmail || undefined,
      orderType,
      pickupTime: pickupTime || undefined,
      notes: orderNotes || undefined
    };

    setIsSubmitting(true);
    try {
      setLastOrderRequest(payload);
      const resp = await api.post(`/api/orders/public/${restaurantSlug}`, payload);
      setLastOrderResponse(resp.data);
      setOrderComplete(resp.data.data.orderId);
      toast.success('Test order placed');
      if (opts?.openCart) setIsCartOpen(true);
    } catch {
      toast.error('Failed to place test order');
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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Head>
        <title>{restaurant.name} - Online Ordering</title>
      </Head>

      {/* Hero Section with Cover Image */}
      <div className="relative h-48 md:h-64 bg-gray-200 overflow-hidden">
        {restaurant.cover_image_url ? (
          <img 
            src={restaurant.cover_image_url} 
            alt={restaurant.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center justify-center">
            <h1 className="text-4xl font-bold text-white opacity-20">{restaurant.name}</h1>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white max-w-4xl mx-auto w-full">
          <div className="flex items-end gap-4">
            {restaurant.logo_url && (
              <div className="w-20 h-20 bg-white rounded-2xl p-1 shadow-lg shrink-0">
                <img src={restaurant.logo_url} alt="Logo" className="w-full h-full object-contain rounded-xl" />
              </div>
            )}
            <div className="mb-2">
              <h1 className="text-3xl font-bold">{restaurant.name}</h1>
              <p className="text-white/80 text-sm line-clamp-1 mt-1">{restaurant.description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-wrap gap-4 text-sm text-gray-600">
          <span className="flex items-center"><Clock className="w-4 h-4 mr-1 text-blue-600" /> Pickup in 20-30 mins</span>
          {restaurant.address?.city && (
            <span className="flex items-center"><MapPin className="w-4 h-4 mr-1 text-blue-600" /> {restaurant.address.city}, {restaurant.address.state}</span>
          )}
          {restaurant.phone && (
            <span className="flex items-center"><Phone className="w-4 h-4 mr-1 text-blue-600" /> {restaurant.phone}</span>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {testMode ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Bug className="h-5 w-5 text-amber-700" />
                <div className="font-bold text-amber-900">Testing Panel (dev only)</div>
              </div>
              <a
                href="/tablet/orders"
                className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-bold text-white"
              >
                Open Tablet Orders <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-white p-4 border border-amber-200">
                <div className="text-sm font-bold text-slate-900">Customer / Order Defaults</div>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <input
                    className="input-field"
                    placeholder="Customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <input
                    className="input-field"
                    placeholder="Customer phone (optional)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                  <input
                    className="input-field"
                    placeholder="Customer email (optional)"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={clsx('btn-secondary flex-1', orderType === 'pickup' && 'bg-slate-900 text-white')}
                      onClick={() => setOrderType('pickup')}
                    >
                      Pickup
                    </button>
                    <button
                      type="button"
                      className={clsx('btn-secondary flex-1', orderType === 'delivery' && 'bg-slate-900 text-white')}
                      onClick={() => setOrderType('delivery')}
                    >
                      Delivery
                    </button>
                  </div>
                  <input
                    className="input-field"
                    type="datetime-local"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                  />
                  <textarea
                    className="input-field"
                    rows={3}
                    placeholder="Order notes (testing)"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-white p-4 border border-amber-200">
                <div className="text-sm font-bold text-slate-900">Quick Actions</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" className="btn-secondary" onClick={() => addRandomItems(3)}>
                    <Wand2 className="inline h-4 w-4 mr-1" />
                    Add 3 random
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => addRandomItems(15)}>
                    <Zap className="inline h-4 w-4 mr-1" />
                    Add 15 random
                  </button>
                  <button type="button" className="btn-primary" onClick={() => sendTestOrder({ itemsCount: 3 })} disabled={isSubmitting}>
                    Place 3‑item order
                  </button>
                  <button type="button" className="btn-primary" onClick={() => sendTestOrder({ itemsCount: 12 })} disabled={isSubmitting}>
                    Place 12‑item order
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setCart([])}>
                    Clear cart
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setIsCartOpen(true)}>
                    Open cart
                  </button>
                </div>

                {(lastOrderRequest || lastOrderResponse) ? (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-600">Last payload</div>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
                        onClick={() => copyJson({ request: lastOrderRequest, response: lastOrderResponse })}
                      >
                        <CopyIcon className="h-4 w-4" />
                        Copy JSON
                      </button>
                    </div>
                    <pre className="max-h-56 overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">
{JSON.stringify({ request: lastOrderRequest, response: lastOrderResponse }, null, 2)}
                    </pre>
                    <div className="text-xs text-slate-600">
                      API base: <span className="font-mono">{String(api.defaults.baseURL || '')}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-8">
          {Array.from(new Set(items.map(i => i.category_name))).map(cat => (
            <div key={cat}>
              <h2 className="text-xl font-bold mb-4 border-b pb-2">{cat}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.filter(i => i.category_name === cat).map(item => (
                  <div key={item.id} className="bg-white p-4 rounded-xl border hover:shadow-md transition-all flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-lg">{item.name}</h3>
                      <p className="text-gray-500 text-sm mb-2">{item.description}</p>
                      <p className="font-bold text-blue-600">${item.price.toFixed(2)}</p>
                    </div>
                    <button 
                      onClick={() => addToCart(item)}
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
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

                <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-bold text-slate-900">Customer</div>
                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <input
                      className="input-field"
                      placeholder="Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                    <input
                      className="input-field"
                      placeholder="Phone (optional)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                    <input
                      className="input-field"
                      placeholder="Email (optional)"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={clsx('btn-secondary flex-1', orderType === 'pickup' && 'bg-slate-900 text-white')}
                        onClick={() => setOrderType('pickup')}
                      >
                        Pickup
                      </button>
                      <button
                        type="button"
                        className={clsx('btn-secondary flex-1', orderType === 'delivery' && 'bg-slate-900 text-white')}
                        onClick={() => setOrderType('delivery')}
                      >
                        Delivery
                      </button>
                    </div>
                    <textarea
                      className="input-field"
                      rows={3}
                      placeholder="Special instructions / notes (testing)"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                    />
                  </div>
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

                <button 
                  disabled={isSubmitting}
                  onClick={handleCheckout}
                  className="w-full btn-primary py-4 text-lg flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : 'Confirm Order & Pay at Pickup'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
