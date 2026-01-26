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
import { resolveMediaUrl } from '../../lib/utils';

interface ItemSize {
  id: string;
  sizeName: string;
  price: number;
  isPreselected: boolean;
  displayOrder: number;
}

interface ModifierOption {
  id: string;
  name: string;
  description: string | null;
  priceDelta: number;
  isActive: boolean;
  isSoldOut: boolean;
  isPreselected: boolean;
  displayOrder: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  description: string | null;
  selectionType: 'single' | 'multiple' | 'quantity';
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  displayOrder: number;
  assignmentLevel: 'item' | 'category';
  options: ModifierOption[];
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  fromPrice?: number;
  is_available: boolean;
  category_name: string;
  images?: string[];
  image?: string;
  sizes?: ItemSize[];
  modifierGroups?: ModifierGroup[];
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

interface SelectedModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
  quantity?: number;
}

interface CartItem extends MenuItem {
  quantity: number;
  selectedSize?: ItemSize;
  selectedModifiers: SelectedModifier[];
  calculatedPrice: number; // Base price + size + modifiers
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

  // Item detail modal state
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedSize, setSelectedSize] = useState<ItemSize | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, SelectedModifier[]>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantSlug) return;

    const fetchData = async () => {
      try {
        const resp = await api.get(`/api/menu/public/${restaurantSlug}`);
        setRestaurant(resp.data.data.restaurant);
        const rawItems = resp.data.data.items || [];
        const normalized = rawItems.map((item: any) => {
          let images: string[] = [];
          if (Array.isArray(item.images)) {
            images = item.images;
          } else if (typeof item.images === 'string') {
            try {
              images = JSON.parse(item.images);
            } catch {
              images = [];
            }
          }
          return {
            ...item,
            description: item.description || '',
            images,
            image: images[0]
          } as MenuItem;
        });
        setItems(normalized);
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

  const openItemDetail = (item: MenuItem) => {
    setSelectedItem(item);
    setCurrentStep(0);
    setValidationError(null);
    // Pre-select size if only one or if one is marked as preselected
    if (item.sizes && item.sizes.length > 0) {
      const preselected = item.sizes.find(s => s.isPreselected);
      setSelectedSize(preselected || item.sizes[0]);
    } else {
      setSelectedSize(null);
    }
    // Pre-select required modifiers
    const preselectedMods: Record<string, SelectedModifier[]> = {};
    if (item.modifierGroups) {
      item.modifierGroups.forEach(group => {
        const preselectedOptions = group.options.filter(opt => opt.isPreselected && !opt.isSoldOut);
        if (preselectedOptions.length > 0) {
          preselectedMods[group.id] = preselectedOptions.map(opt => ({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            optionName: opt.name,
            priceDelta: opt.priceDelta,
            quantity: group.selectionType === 'quantity' ? 1 : undefined
          }));
        }
      });
    }
    setSelectedModifiers(preselectedMods);
  };

  const addToCartWithSelections = () => {
    if (!selectedItem) return;

    // Validate required modifiers (only for groups with selectable options)
    if (selectedItem.modifierGroups) {
      const validGroups = selectedItem.modifierGroups.filter(
        group => group.options && group.options.length > 0 && group.options.some(opt => opt.isActive && !opt.isSoldOut)
      );
      for (const group of validGroups) {
        if (group.isRequired) {
          const selections = selectedModifiers[group.id] || [];
          const totalSelected = selections.reduce((sum, sel) => sum + (sel.quantity || 1), 0);
          if (totalSelected < group.minSelections) {
            toast.error(`Please select at least ${group.minSelections} option(s) for ${group.name}`);
            return;
          }
        }
      }
    }

    // Calculate price
    const basePrice = selectedSize ? selectedSize.price : selectedItem.price;
    const modifierPrice = Object.values(selectedModifiers)
      .flat()
      .reduce((sum, mod) => sum + (mod.priceDelta * (mod.quantity || 1)), 0);
    const calculatedPrice = basePrice + modifierPrice;

    const cartItem: CartItem = {
      ...selectedItem,
      quantity: 1,
      selectedSize: selectedSize || undefined,
      selectedModifiers: Object.values(selectedModifiers).flat(),
      calculatedPrice
    };

    setCart(prev => {
      // Check if exact same item with same selections exists
      const existing = prev.find(i =>
        i.id === selectedItem.id &&
        i.selectedSize?.id === cartItem.selectedSize?.id &&
        JSON.stringify(i.selectedModifiers.sort()) === JSON.stringify(cartItem.selectedModifiers.sort())
      );

      if (existing) {
        return prev.map(i =>
          i.id === existing.id &&
          i.selectedSize?.id === existing.selectedSize?.id &&
          JSON.stringify(i.selectedModifiers.sort()) === JSON.stringify(existing.selectedModifiers.sort())
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, cartItem];
    });

    toast.success('Added to cart');
    setSelectedItem(null);
    setSelectedSize(null);
    setSelectedModifiers({});
    setCurrentStep(0);
    setValidationError(null);
  };

  // Get steps for current item
  const getSteps = () => {
    if (!selectedItem) return [];
    const steps: Array<{ type: 'size' | 'modifier', data?: ModifierGroup }> = [];

    // Add size step if item has sizes
    if (selectedItem.sizes && selectedItem.sizes.length > 0) {
      steps.push({ type: 'size' });
    }

    // Add modifier group steps (only groups with selectable options)
    if (selectedItem.modifierGroups) {
      const validGroups = selectedItem.modifierGroups.filter(
        group => group.options && group.options.length > 0 && group.options.some(opt => opt.isActive && !opt.isSoldOut)
      );
      validGroups.forEach(group => {
        steps.push({ type: 'modifier', data: group });
      });
    }

    return steps;
  };

  // Validate current step
  const validateCurrentStep = () => {
    if (!selectedItem) return true;
    const steps = getSteps();
    if (currentStep >= steps.length) return true;

    const step = steps[currentStep];

    if (step.type === 'size') {
      if (!selectedSize) {
        setValidationError('Please select a size to continue');
        return false;
      }
    } else if (step.type === 'modifier' && step.data) {
      const group = step.data;
      if (group.isRequired) {
        const selections = selectedModifiers[group.id] || [];
        const totalSelected = selections.reduce((sum, sel) => sum + (sel.quantity || 1), 0);
        if (totalSelected < group.minSelections) {
          setValidationError(`Please select at least ${group.minSelections} option(s) for ${group.name}`);
          return false;
        }
      }
    }

    setValidationError(null);
    return true;
  };

  // Navigate to next step
  const handleNext = () => {
    if (!validateCurrentStep()) return;
    const steps = getSteps();
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      setValidationError(null);
    } else {
      // Last step, add to cart
      addToCartWithSelections();
    }
  };

  // Navigate to previous step
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setValidationError(null);
    }
  };

  const removeFromCart = (cartIndex: number) => {
    setCart(prev => {
      const item = prev[cartIndex];
      if (item.quantity > 1) {
        return prev.map((i, idx) => idx === cartIndex ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter((_, idx) => idx !== cartIndex);
    });
  };

  const increaseCartItemQuantity = (cartIndex: number) => {
    setCart(prev => prev.map((i, idx) => idx === cartIndex ? { ...i, quantity: i.quantity + 1 } : i));
  };

  const cartTotal = cart.reduce((sum, i) => sum + (i.calculatedPrice * i.quantity), 0);

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
        items: cart.map(i => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          price: i.calculatedPrice,
          selectedSize: i.selectedSize ? {
            id: i.selectedSize.id,
            name: i.selectedSize.sizeName,
            price: i.selectedSize.price
          } : null,
          selectedModifiers: i.selectedModifiers.map(mod => ({
            groupId: mod.groupId,
            groupName: mod.groupName,
            optionId: mod.optionId,
            optionName: mod.optionName,
            priceDelta: mod.priceDelta,
            quantity: mod.quantity
          }))
        })),
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
    const normalizedStatus = (orderStatus || '').toLowerCase();
    const isCancelled = normalizedStatus === 'cancelled' || normalizedStatus === 'canceled' || normalizedStatus === 'declined';
    const headline = isCancelled ? 'Order Cancelled' : 'Order Confirmed!';
    const subcopy = isCancelled
      ? 'Your order was declined by the restaurant.'
      : 'Thank you for your order';
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b ${isCancelled ? 'from-red-50 to-white' : 'from-green-50 to-white'}`}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
        >
          <CheckCircle2 className={`h-24 w-24 mb-6 ${isCancelled ? 'text-red-500' : 'text-green-500'}`} />
        </motion.div>
        <h1 className="text-4xl font-bold mb-2">{headline}</h1>
        <p className="text-xl text-gray-600 mb-6">{subcopy}</p>
        
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 w-full max-w-sm">
          <div className="text-sm text-gray-500 uppercase tracking-widest mb-1">Order Number</div>
          <div className="text-3xl font-mono font-bold text-blue-600 mb-4">
            #{orderComplete.slice(-6).toUpperCase()}
          </div>
          
          {pickupTime && !isCancelled && (
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
                normalizedStatus === 'received' ? 'bg-blue-100 text-blue-700' :
                normalizedStatus === 'preparing' ? 'bg-amber-100 text-amber-700' :
                normalizedStatus === 'ready' ? 'bg-green-100 text-green-700' :
                normalizedStatus === 'cancelled' || normalizedStatus === 'canceled' || normalizedStatus === 'declined' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {orderStatus}
              </div>
            </div>
          )}
        </div>

        {!isCancelled && (
          <p className="text-gray-500 mb-6 max-w-sm">
            We'll send you a text when your order is ready for pickup!
          </p>
        )}
        
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24">
      <Head>
        <title>{restaurant.name} - Online Ordering</title>
      </Head>

      {/* Premium Hero Section */}
      <div className="relative h-56 md:h-72 overflow-hidden">
        {restaurant.cover_image_url ? (
          <img 
            src={restaurant.cover_image_url} 
            alt={restaurant.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        {/* Restaurant Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-5">
              {restaurant.logo_url && (
                <motion.div 
                  className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-2xl p-2 shadow-2xl shrink-0"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <img src={restaurant.logo_url} alt="Logo" className="w-full h-full object-contain rounded-xl" />
                </motion.div>
              )}
              <motion.div 
                className="mb-1"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{restaurant.name}</h1>
                {restaurant.description && (
                  <p className="text-white/70 text-sm md:text-base mt-1 line-clamp-2 max-w-md">{restaurant.description}</p>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Bar */}
      <div className="bg-white/80 backdrop-blur-xl shadow-sm border-b border-slate-200/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-3 md:gap-6 text-sm">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">
              <Clock className="w-4 h-4" /> 20-30 min
            </span>
            {restaurant.address?.city && (
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400" /> {restaurant.address.city}, {restaurant.address.state}
              </span>
            )}
            {restaurant.phone && (
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <Phone className="w-4 h-4 text-slate-400" /> {restaurant.phone}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-10">
          {Array.from(new Set(items.map(i => i.category_name))).map((cat, catIndex) => (
            <motion.div 
              key={cat}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: catIndex * 0.1 }}
            >
              <h2 className="text-2xl font-black text-slate-900 mb-5">{cat}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.filter(i => i.category_name === cat).map((item, itemIndex) => (
                  <motion.div 
                    key={item.id} 
                    className="group bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-xl hover:border-slate-200 transition-all duration-300"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (catIndex * 0.1) + (itemIndex * 0.05) }}
                    whileHover={{ y: -2 }}
                  >
                    <div className="flex justify-between items-start gap-3 sm:gap-4">
                      <div className="flex-1 flex gap-3 sm:gap-4">
                        {item.image && (
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
                            <img
                              src={resolveMediaUrl(item.image)}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                        <h3 className="font-bold text-base sm:text-lg text-slate-900 group-hover:text-blue-600 transition-colors">{item.name}</h3>
                        <p className="text-slate-500 text-xs sm:text-sm mt-1 line-clamp-2">{item.description}</p>
                        <p className="font-black text-lg sm:text-xl text-slate-900 mt-2 sm:mt-3">
                          {item.sizes && item.sizes.length > 0 ? (
                            <>From ${item.fromPrice?.toFixed(2) || item.price.toFixed(2)}</>
                          ) : (
                            <>${item.price.toFixed(2)}</>
                          )}
                        </p>
                        </div>
                      </div>
                      <button
                        onClick={() => openItemDetail(item)}
                        className="shrink-0 p-2.5 sm:p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label={`Add ${item.name} to cart`}
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {cart.length > 0 && (
        <motion.div 
          className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-xl border-t border-slate-200/50 shadow-2xl shadow-slate-900/10 z-50"
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ type: "spring", bounce: 0.3 }}
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-blue-600" />
                </div>
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Your Order</p>
                <p className="text-xl font-black text-slate-900">${cartTotal.toFixed(2)}</p>
              </div>
            </div>
            <button 
              onClick={() => setIsCartOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg shadow-blue-600/30 transition-all active:scale-95"
            >
              View Cart
            </button>
          </div>
        </motion.div>
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
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[70] p-6 pb-safe-bottom max-h-[90vh] overflow-y-auto"
              style={{ maxHeight: 'calc(100vh - env(safe-area-inset-top, 0px))' }}
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
                      {cart.map((item, index) => (
                        <div key={index} className="flex justify-between items-start gap-3">
                          <div className="flex-1">
                            <div className="font-semibold">{item.name}</div>
                            {item.selectedSize && (
                              <div className="text-xs text-gray-500 mt-0.5">Size: {item.selectedSize.sizeName}</div>
                            )}
                            {item.selectedModifiers.length > 0 && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {item.selectedModifiers.map((mod, idx) => (
                                  <div key={idx}>
                                    {mod.optionName}
                                    {mod.quantity && mod.quantity > 1 ? ` (x${mod.quantity})` : ''}
                                    {mod.priceDelta > 0 && ` +$${mod.priceDelta.toFixed(2)}`}
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="text-sm text-gray-900 font-medium mt-1">${item.calculatedPrice.toFixed(2)}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => removeFromCart(index)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"><Minus className="w-4 h-4" /></button>
                            <span className="font-bold w-8 text-center">{item.quantity}</span>
                            <button onClick={() => increaseCartItemQuantity(index)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"><Plus className="w-4 h-4" /></button>
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
                          onFocus={(e) => {
                            setTimeout(() => {
                              e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 300);
                          }}
                          placeholder="Enter your name"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-lg scroll-mt-24"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          <Phone className="w-4 h-4 inline mr-2" />
                          Phone Number *
                        </label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={customerInfo.phone}
                          onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                          onFocus={(e) => {
                            setTimeout(() => {
                              e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 300);
                          }}
                          placeholder="(555) 123-4567"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-lg scroll-mt-24"
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
                          onFocus={(e) => {
                            setTimeout(() => {
                              e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 300);
                          }}
                          placeholder="Allergies, dietary requests, etc."
                          rows={2}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none scroll-mt-24"
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

      {/* Item Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[60]"
              onClick={() => setSelectedItem(null)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[70] p-6 pb-safe-bottom max-h-[90vh] overflow-y-auto"
            >
              <div className="max-w-xl mx-auto">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold">{selectedItem.name}</h2>
                    <p className="text-gray-600 mt-1">{selectedItem.description}</p>
                  </div>
                  <button onClick={() => setSelectedItem(null)} className="text-gray-400 font-bold ml-4">Close</button>
                </div>

                {selectedItem.image && (
                  <div className="w-full h-48 rounded-xl overflow-hidden bg-gray-100 mb-6">
                    <img
                      src={resolveMediaUrl(selectedItem.image)}
                      alt={selectedItem.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Step Progress Indicator */}
                {(() => {
                  const steps = getSteps();
                  if (steps.length > 1) {
                    return (
                      <div className="mb-6">
                        <div className="flex items-center justify-between">
                          {steps.map((step, idx) => (
                            <React.Fragment key={idx}>
                              <div className="flex flex-col items-center flex-1">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                  idx < currentStep ? 'bg-green-600 text-white' :
                                  idx === currentStep ? 'bg-blue-600 text-white' :
                                  'bg-gray-200 text-gray-500'
                                }`}>
                                  {idx < currentStep ? '✓' : idx + 1}
                                </div>
                                <div className={`text-xs mt-1 text-center ${
                                  idx === currentStep ? 'font-semibold text-blue-600' : 'text-gray-500'
                                }`}>
                                  {step.type === 'size' ? 'Size' : step.data?.name}
                                </div>
                              </div>
                              {idx < steps.length - 1 && (
                                <div className={`h-0.5 flex-1 mx-2 mb-6 ${
                                  idx < currentStep ? 'bg-green-600' : 'bg-gray-200'
                                }`} />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Current Step Content */}
                {(() => {
                  const steps = getSteps();
                  if (steps.length === 0) return null;
                  const step = steps[currentStep];

                  if (step.type === 'size') {
                    return (
                      <div className="mb-6">
                        <h3 className="font-semibold text-lg mb-3">Select Size *</h3>
                        <div className="space-y-2">
                          {selectedItem.sizes?.map(size => (
                            <button
                              key={size.id}
                              onClick={() => {
                                setSelectedSize(size);
                                setValidationError(null);
                              }}
                              className={`w-full p-4 rounded-xl border-2 flex justify-between items-center transition-all ${
                                selectedSize?.id === size.id
                                  ? 'border-blue-600 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <span className="font-semibold">{size.sizeName}</span>
                              <span className="font-bold text-lg">${size.price.toFixed(2)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  if (step.type === 'modifier' && step.data) {
                    const group = step.data;
                    return (
                      <div className="mb-6">
                        <div className="flex justify-between items-baseline mb-3">
                          <h3 className="font-semibold text-lg">
                            {group.name}
                            {group.isRequired && <span className="text-red-500 ml-1">*</span>}
                          </h3>
                          <span className="text-sm text-gray-500">
                            {group.selectionType === 'single' && 'Choose 1'}
                            {group.selectionType === 'multiple' && `Choose ${group.minSelections}-${group.maxSelections}`}
                            {group.selectionType === 'quantity' && 'Add quantity'}
                          </span>
                        </div>
                        {group.description && (
                          <p className="text-sm text-gray-500 mb-3">{group.description}</p>
                        )}

                        <div className="space-y-2">
                          {group.options.map(option => {
                            const isSelected = selectedModifiers[group.id]?.some(m => m.optionId === option.id);
                            const selectedMod = selectedModifiers[group.id]?.find(m => m.optionId === option.id);

                            const handleToggle = () => {
                              setValidationError(null);
                              if (group.selectionType === 'single') {
                                setSelectedModifiers(prev => ({
                                  ...prev,
                                  [group.id]: [{
                                    groupId: group.id,
                                    groupName: group.name,
                                    optionId: option.id,
                                    optionName: option.name,
                                    priceDelta: option.priceDelta
                                  }]
                                }));
                              } else if (group.selectionType === 'multiple') {
                                setSelectedModifiers(prev => {
                                  const current = prev[group.id] || [];
                                  if (isSelected) {
                                    const filtered = current.filter(m => m.optionId !== option.id);
                                    if (filtered.length === 0) {
                                      const { [group.id]: _, ...rest } = prev;
                                      return rest;
                                    }
                                    return { ...prev, [group.id]: filtered };
                                  } else {
                                    if (current.length >= group.maxSelections) {
                                      setValidationError(`Maximum ${group.maxSelections} selections allowed`);
                                      return prev;
                                    }
                                    return {
                                      ...prev,
                                      [group.id]: [...current, {
                                        groupId: group.id,
                                        groupName: group.name,
                                        optionId: option.id,
                                        optionName: option.name,
                                        priceDelta: option.priceDelta
                                      }]
                                    };
                                  }
                                });
                              } else if (group.selectionType === 'quantity') {
                                if (!isSelected) {
                                  setSelectedModifiers(prev => ({
                                    ...prev,
                                    [group.id]: [...(prev[group.id] || []), {
                                      groupId: group.id,
                                      groupName: group.name,
                                      optionId: option.id,
                                      optionName: option.name,
                                      priceDelta: option.priceDelta,
                                      quantity: 1
                                    }]
                                  }));
                                }
                              }
                            };

                            const handleQuantityChange = (delta: number) => {
                              setSelectedModifiers(prev => {
                                const current = prev[group.id] || [];
                                const modIndex = current.findIndex(m => m.optionId === option.id);
                                if (modIndex === -1) return prev;

                                const newQuantity = (current[modIndex].quantity || 1) + delta;
                                if (newQuantity <= 0) {
                                  const filtered = current.filter(m => m.optionId !== option.id);
                                  if (filtered.length === 0) {
                                    const { [group.id]: _, ...rest } = prev;
                                    return rest;
                                  }
                                  return { ...prev, [group.id]: filtered };
                                }

                                const updated = [...current];
                                updated[modIndex] = { ...updated[modIndex], quantity: newQuantity };
                                return { ...prev, [group.id]: updated };
                              });
                            };

                            return (
                              <div key={option.id}>
                                <button
                                  onClick={handleToggle}
                                  disabled={option.isSoldOut}
                                  className={`w-full p-4 rounded-xl border-2 transition-all ${
                                    option.isSoldOut ? 'opacity-50 cursor-not-allowed bg-gray-50' :
                                    isSelected ? 'border-blue-600 bg-blue-50' :
                                    'border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <div className="flex justify-between items-center w-full">
                                    <div className="text-left flex-1">
                                      <div className="font-semibold">
                                        {option.name}
                                        {option.isSoldOut && <span className="ml-2 text-sm text-red-500">(Sold Out)</span>}
                                      </div>
                                      {option.description && (
                                        <div className="text-sm text-gray-500 mt-1">{option.description}</div>
                                      )}
                                    </div>
                                    {option.priceDelta !== 0 && (
                                      <span className="text-sm font-medium text-gray-700 ml-2">
                                        {option.priceDelta > 0 ? '+' : ''}${option.priceDelta.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </button>

                                {group.selectionType === 'quantity' && isSelected && selectedMod && (
                                  <div className="flex items-center gap-2 ml-4 mt-2">
                                    <button
                                      onClick={() => handleQuantityChange(-1)}
                                      className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300"
                                    >
                                      <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="font-bold w-6 text-center">{selectedMod.quantity || 1}</span>
                                    <button
                                      onClick={() => handleQuantityChange(1)}
                                      className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  return null;
                })()}

                {/* Validation Error Modal */}
                {validationError && (
                  <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg mb-2">Selection Required</h3>
                          <p className="text-gray-600">{validationError}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setValidationError(null)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold"
                      >
                        Got it
                      </button>
                    </motion.div>
                  </div>
                )}

                {/* Hidden section - we'll replace the old modifier groups rendering */}
                {false && selectedItem?.modifierGroups && selectedItem?.modifierGroups
                  ?.filter(group => group.options && group.options.length > 0 && group.options.some(opt => opt.isActive && !opt.isSoldOut))
                  .map(group => (
                  <div key={group.id} className="mb-6">
                    <div className="flex justify-between items-baseline mb-3">
                      <h3 className="font-semibold text-lg">
                        {group.name}
                        {group.isRequired && <span className="text-red-500 ml-1">*</span>}
                      </h3>
                      <span className="text-sm text-gray-500">
                        {group.selectionType === 'single' && 'Choose 1'}
                        {group.selectionType === 'multiple' && `Choose ${group.minSelections}-${group.maxSelections}`}
                        {group.selectionType === 'quantity' && 'Add quantity'}
                      </span>
                    </div>
                    {group.description && (
                      <p className="text-sm text-gray-500 mb-3">{group.description}</p>
                    )}

                    <div className="space-y-2">
                      {group.options.map(option => {
                        const isSelected = selectedModifiers[group.id]?.some(m => m.optionId === option.id);
                        const selectedMod = selectedModifiers[group.id]?.find(m => m.optionId === option.id);

                        const handleToggle = () => {
                          if (group.selectionType === 'single') {
                            // Single selection - replace existing
                            setSelectedModifiers(prev => ({
                              ...prev,
                              [group.id]: [{
                                groupId: group.id,
                                groupName: group.name,
                                optionId: option.id,
                                optionName: option.name,
                                priceDelta: option.priceDelta
                              }]
                            }));
                          } else if (group.selectionType === 'multiple') {
                            // Multiple selection - toggle
                            setSelectedModifiers(prev => {
                              const current = prev[group.id] || [];
                              if (isSelected) {
                                const filtered = current.filter(m => m.optionId !== option.id);
                                if (filtered.length === 0) {
                                  const { [group.id]: _, ...rest } = prev;
                                  return rest;
                                }
                                return { ...prev, [group.id]: filtered };
                              } else {
                                // Check max selections
                                if (current.length >= group.maxSelections) {
                                  toast.error(`Maximum ${group.maxSelections} selections allowed`);
                                  return prev;
                                }
                                return {
                                  ...prev,
                                  [group.id]: [...current, {
                                    groupId: group.id,
                                    groupName: group.name,
                                    optionId: option.id,
                                    optionName: option.name,
                                    priceDelta: option.priceDelta
                                  }]
                                };
                              }
                            });
                          } else if (group.selectionType === 'quantity') {
                            // Quantity - add with quantity 1
                            if (!isSelected) {
                              setSelectedModifiers(prev => ({
                                ...prev,
                                [group.id]: [...(prev[group.id] || []), {
                                  groupId: group.id,
                                  groupName: group.name,
                                  optionId: option.id,
                                  optionName: option.name,
                                  priceDelta: option.priceDelta,
                                  quantity: 1
                                }]
                              }));
                            }
                          }
                        };

                        const handleQuantityChange = (delta: number) => {
                          setSelectedModifiers(prev => {
                            const current = prev[group.id] || [];
                            const mod = current.find(m => m.optionId === option.id);
                            if (!mod) return prev;

                            const newQuantity = (mod.quantity || 1) + delta;
                            if (newQuantity <= 0) {
                              const filtered = current.filter(m => m.optionId !== option.id);
                              if (filtered.length === 0) {
                                const { [group.id]: _, ...rest } = prev;
                                return rest;
                              }
                              return { ...prev, [group.id]: filtered };
                            }

                            return {
                              ...prev,
                              [group.id]: current.map(m =>
                                m.optionId === option.id ? { ...m, quantity: newQuantity } : m
                              )
                            };
                          });
                        };

                        return (
                          <div
                            key={option.id}
                            className={`p-4 rounded-xl border-2 transition-all ${
                              option.isSoldOut
                                ? 'border-gray-200 bg-gray-50 opacity-50'
                                : isSelected
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <button
                                onClick={handleToggle}
                                disabled={option.isSoldOut}
                                className="flex-1 flex justify-between items-center text-left"
                              >
                                <div>
                                  <div className="font-semibold">
                                    {option.name}
                                    {option.isSoldOut && <span className="text-sm text-red-500 ml-2">(Sold Out)</span>}
                                  </div>
                                  {option.description && (
                                    <div className="text-sm text-gray-500 mt-0.5">{option.description}</div>
                                  )}
                                </div>
                                {option.priceDelta > 0 && (
                                  <span className="text-sm font-medium text-gray-700 ml-2">+${option.priceDelta.toFixed(2)}</span>
                                )}
                              </button>

                              {group.selectionType === 'quantity' && isSelected && selectedMod && (
                                <div className="flex items-center gap-2 ml-4">
                                  <button
                                    onClick={() => handleQuantityChange(-1)}
                                    className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <span className="font-bold w-6 text-center">{selectedMod.quantity || 1}</span>
                                  <button
                                    onClick={() => handleQuantityChange(1)}
                                    className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Price Summary and Navigation Buttons */}
                <div className="border-t pt-4 sticky bottom-0 bg-white">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold">Item Total</span>
                    <span className="text-2xl font-bold">
                      ${(
                        (selectedSize ? selectedSize.price : selectedItem.price) +
                        Object.values(selectedModifiers)
                          .flat()
                          .reduce((sum, mod) => sum + (mod.priceDelta * (mod.quantity || 1)), 0)
                      ).toFixed(2)}
                    </span>
                  </div>

                  {(() => {
                    const steps = getSteps();
                    const isLastStep = currentStep === steps.length - 1;
                    const isFirstStep = currentStep === 0;

                    return (
                      <div className="flex gap-3">
                        {!isFirstStep && (
                          <button
                            onClick={handlePrevious}
                            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2"
                          >
                            <ArrowLeft className="w-5 h-5" />
                            Previous
                          </button>
                        )}
                        <button
                          onClick={handleNext}
                          className={`${isFirstStep ? 'w-full' : 'flex-1'} bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2`}
                        >
                          {isLastStep ? (
                            <>
                              <ShoppingCart className="w-5 h-5" />
                              Add to Cart
                            </>
                          ) : (
                            <>
                              Next
                              <ArrowRight className="w-5 h-5" />
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
