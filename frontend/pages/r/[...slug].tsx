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
  CheckCircle2,
  CreditCard,
  Wallet,
  User,
  ArrowLeft,
  ArrowRight
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

  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [pickupTime, setPickupTime] = useState<string | null>(null);
  
  // Checkout flow state
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'details' | 'payment'>('cart');
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    orderType: 'pickup', // 'pickup' or 'dine-in'
    specialInstructions: ''
  });
  const [paymentMethod, setPaymentMethod] = useState<'pickup' | 'online'>('pickup');
  const [onlinePaymentsEnabled, setOnlinePaymentsEnabled] = useState(false);

  useEffect(() => {
    if (!restaurantSlug) return;

    const fetchData = async () => {
      try {
        const resp = await api.get(`/api/menu/public/${restaurantSlug}`);
        setRestaurant(resp.data.data.restaurant);
        setItems(resp.data.data.items);
        // Check if online payments are enabled
        const settings = resp.data.data.restaurant?.settings;
        if (settings?.online_payments_enabled) {
          setOnlinePaymentsEnabled(true);
        }
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

  const validateCustomerInfo = () => {
    if (!customerInfo.name.trim()) {
      toast.error('Please enter your name');
      return false;
    }
    if (!customerInfo.phone.trim()) {
      toast.error('Please enter your phone number');
      return false;
    }
    // Basic phone validation
    const phoneDigits = customerInfo.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Please enter a valid phone number');
      return false;
    }
    return true;
  };

  const handleProceedToPayment = () => {
    if (validateCustomerInfo()) {
      if (onlinePaymentsEnabled) {
        setCheckoutStep('payment');
      } else {
        // No online payments, go straight to order
        handlePlaceOrder();
      }
    }
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    if (!validateCustomerInfo()) return;
    
    setIsSubmitting(true);
    try {
      const resp = await api.post(`/api/orders/public/${restaurantSlug}`, {
        items: cart.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
        customerName: customerInfo.name.trim(),
        customerPhone: customerInfo.phone.trim(),
        orderType: customerInfo.orderType,
        specialInstructions: customerInfo.specialInstructions.trim() || null,
        paymentMethod: paymentMethod
      });
      setOrderComplete(resp.data.data.orderId);
      setOrderStatus(resp.data.data.status || null);
      setCart([]);
      setIsCartOpen(false);
      setCheckoutStep('cart');
      setCustomerInfo({ name: '', phone: '', orderType: 'pickup', specialInstructions: '' });
    } catch (err) {
      toast.error('Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckout = async () => {
    // Legacy function - now opens checkout flow
    setCheckoutStep('details');
  };

  useEffect(() => {
    if (!orderComplete) return;
    const poll = async () => {
      try {
        const resp = await api.get(`/api/orders/public/order/${orderComplete}`);
        const data = resp.data?.data;
        if (data?.status) setOrderStatus(data.status);
        if (data?.pickup_time) setPickupTime(data.pickup_time);
      } catch {
        // ignore polling errors
      }
    };
    poll();
    const t = window.setInterval(poll, 15000);
    return () => window.clearInterval(t);
  }, [orderComplete]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  if (error || !restaurant) return <div className="min-h-screen flex items-center justify-center font-bold text-red-600">{error || 'Restaurant not found'}</div>;

  if (orderComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-green-50 to-white">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
        >
          <CheckCircle2 className="h-24 w-24 text-green-500 mb-6" />
        </motion.div>
        <h1 className="text-4xl font-bold mb-2">Order Confirmed!</h1>
        <p className="text-xl text-gray-600 mb-6">
          Thank you for your order
        </p>
        
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 w-full max-w-sm">
          <div className="text-sm text-gray-500 uppercase tracking-widest mb-1">Order Number</div>
          <div className="text-3xl font-mono font-bold text-blue-600 mb-4">
            #{orderComplete.slice(-6).toUpperCase()}
          </div>
          
          {pickupTime && (
            <div className="border-t pt-4 mt-4">
              <div className="text-sm text-gray-500 uppercase tracking-widest mb-1">Ready For Pickup</div>
              <div className="text-2xl font-bold text-gray-900">
                {new Date(pickupTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}
          
          {orderStatus && (
            <div className="border-t pt-4 mt-4">
              <div className="text-sm text-gray-500 uppercase tracking-widest mb-1">Status</div>
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold uppercase ${
                orderStatus === 'received' ? 'bg-blue-100 text-blue-700' :
                orderStatus === 'preparing' ? 'bg-amber-100 text-amber-700' :
                orderStatus === 'ready' ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {orderStatus}
              </div>
            </div>
          )}
        </div>

        <p className="text-gray-500 mb-6 max-w-sm">
          We'll send you a text when your order is ready for pickup!
        </p>
        
        <button 
          onClick={() => setOrderComplete(null)} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-lg"
        >
          Place Another Order
        </button>
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
              onClick={() => { setIsCartOpen(false); setCheckoutStep('cart'); }} 
            />
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[70] p-6 max-h-[85vh] overflow-y-auto"
            >
              <div className="max-w-xl mx-auto">
                {/* Step 1: Cart Review */}
                {checkoutStep === 'cart' && (
                  <>
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold">Your Order</h2>
                      <button onClick={() => setIsCartOpen(false)} className="text-gray-400 font-bold">Close</button>
                    </div>
                    
                    <div className="space-y-4 mb-6">
                      {cart.map(item => (
                        <div key={item.id} className="flex justify-between items-center">
                          <div>
                            <div className="font-semibold">{item.name}</div>
                            <div className="text-sm text-gray-500">${item.price.toFixed(2)}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => removeFromCart(item.id)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"><Minus className="w-4 h-4" /></button>
                            <span className="font-bold w-8 text-center">{item.quantity}</span>
                            <button onClick={() => addToCart(item)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"><Plus className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-4 mb-6">
                      <div className="flex justify-between items-center text-xl font-bold">
                        <span>Total</span>
                        <span>${cartTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setCheckoutStep('details')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2"
                    >
                      Continue to Checkout
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* Step 2: Customer Details */}
                {checkoutStep === 'details' && (
                  <>
                    <div className="flex items-center gap-4 mb-6">
                      <button 
                        onClick={() => setCheckoutStep('cart')}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <h2 className="text-2xl font-bold">Your Details</h2>
                    </div>
                    
                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          <User className="w-4 h-4 inline mr-2" />
                          Your Name *
                        </label>
                        <input
                          type="text"
                          value={customerInfo.name}
                          onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter your name"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          <Phone className="w-4 h-4 inline mr-2" />
                          Phone Number *
                        </label>
                        <input
                          type="tel"
                          value={customerInfo.phone}
                          onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="(555) 123-4567"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-lg"
                        />
                        <p className="text-sm text-gray-500 mt-1">We'll text you when your order is ready</p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Order Type
                        </label>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setCustomerInfo(prev => ({ ...prev, orderType: 'pickup' }))}
                            className={`flex-1 py-3 px-4 rounded-xl border-2 font-semibold transition-all ${
                              customerInfo.orderType === 'pickup' 
                                ? 'border-blue-600 bg-blue-50 text-blue-700' 
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            Pickup
                          </button>
                          <button
                            onClick={() => setCustomerInfo(prev => ({ ...prev, orderType: 'dine-in' }))}
                            className={`flex-1 py-3 px-4 rounded-xl border-2 font-semibold transition-all ${
                              customerInfo.orderType === 'dine-in' 
                                ? 'border-blue-600 bg-blue-50 text-blue-700' 
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            Dine-In
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Special Instructions (optional)
                        </label>
                        <textarea
                          value={customerInfo.specialInstructions}
                          onChange={(e) => setCustomerInfo(prev => ({ ...prev, specialInstructions: e.target.value }))}
                          placeholder="Allergies, dietary requests, etc."
                          rows={2}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4 mb-4">
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span>Order Total</span>
                        <span>${cartTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    <button 
                      disabled={isSubmitting}
                      onClick={handleProceedToPayment}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <Loader2 className="animate-spin" />
                      ) : onlinePaymentsEnabled ? (
                        <>
                          Continue to Payment
                          <ArrowRight className="w-5 h-5" />
                        </>
                      ) : (
                        <>
                          Place Order - Pay at Pickup
                          <CheckCircle2 className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </>
                )}

                {/* Step 3: Payment Selection (only if online payments enabled) */}
                {checkoutStep === 'payment' && (
                  <>
                    <div className="flex items-center gap-4 mb-6">
                      <button 
                        onClick={() => setCheckoutStep('details')}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <h2 className="text-2xl font-bold">Payment Method</h2>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <button
                        onClick={() => setPaymentMethod('pickup')}
                        className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                          paymentMethod === 'pickup' 
                            ? 'border-blue-600 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          paymentMethod === 'pickup' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          <Wallet className="w-6 h-6" />
                        </div>
                        <div className="flex-grow text-left">
                          <div className="font-bold text-lg">Pay at Pickup</div>
                          <div className="text-sm text-gray-500">Pay with cash or card when you arrive</div>
                        </div>
                        {paymentMethod === 'pickup' && (
                          <CheckCircle2 className="w-6 h-6 text-blue-600" />
                        )}
                      </button>

                      <button
                        onClick={() => setPaymentMethod('online')}
                        className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                          paymentMethod === 'online' 
                            ? 'border-blue-600 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          paymentMethod === 'online' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          <CreditCard className="w-6 h-6" />
                        </div>
                        <div className="flex-grow text-left">
                          <div className="font-bold text-lg">Pay Now with Card</div>
                          <div className="text-sm text-gray-500">Secure payment, skip the line</div>
                        </div>
                        {paymentMethod === 'online' && (
                          <CheckCircle2 className="w-6 h-6 text-blue-600" />
                        )}
                      </button>
                    </div>

                    {paymentMethod === 'online' && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-amber-800">
                            <strong>Coming Soon:</strong> Online payment integration is being set up. 
                            For now, please select "Pay at Pickup".
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-4 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Subtotal</span>
                        <span>${cartTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xl font-bold mt-2">
                        <span>Total</span>
                        <span>${cartTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    <button 
                      disabled={isSubmitting || paymentMethod === 'online'}
                      onClick={handlePlaceOrder}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          Place Order
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
