import { useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import type { CartItem, MenuItem, ItemSize, SelectedModifier, CustomerInfo, CheckoutStep } from './types';

export function useCart(restaurantSlug: string | undefined) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [pickupTime, setPickupTime] = useState<string | null>(null);
  const [orderCreatedAt, setOrderCreatedAt] = useState<string | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('cart');
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    phone: '',
    email: '',
    orderType: 'pickup',
    specialInstructions: '',
    scheduleForLater: false,
    scheduledPickupTime: null
  });
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pickup' | 'online'>('pickup');

  const cartTotal = useMemo(
    () => cart.reduce((sum, i) => sum + (i.calculatedPrice * i.quantity), 0),
    [cart]
  );

  const cartItemCount = useMemo(
    () => cart.reduce((s, i) => s + i.quantity, 0),
    [cart]
  );

  const addToCart = useCallback((
    item: MenuItem,
    selectedSize: ItemSize | null,
    selectedModifiers: Record<string, SelectedModifier[]>
  ) => {
    // Validate required modifiers
    if (item.modifierGroups) {
      const validGroups = item.modifierGroups.filter(
        group => group.options && group.options.length > 0 && group.options.some(opt => opt.isActive && !opt.isSoldOut)
      );
      for (const group of validGroups) {
        if (group.isRequired) {
          const selections = selectedModifiers[group.id] || [];
          const totalSelected = selections.reduce((sum, sel) => sum + (sel.quantity || 1), 0);
          if (totalSelected < group.minSelections) {
            toast.error(`Please select at least ${group.minSelections} option(s) for ${group.name}`);
            return false;
          }
        }
      }
    }

    const basePrice = selectedSize ? selectedSize.price : item.price;
    const allModifiers: SelectedModifier[] = ([] as SelectedModifier[]).concat(...Object.values(selectedModifiers));
    const modifierPrice = allModifiers
      .reduce((sum: number, mod: SelectedModifier) => sum + (mod.priceDelta * (mod.quantity || 1)), 0);

    const cartItem: CartItem = {
      ...item,
      quantity: 1,
      selectedSize: selectedSize || undefined,
      selectedModifiers: allModifiers,
      calculatedPrice: basePrice + modifierPrice
    };

    setCart(prev => {
      const existing = prev.find(i =>
        i.id === item.id &&
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
    return true;
  }, []);

  const removeFromCart = useCallback((cartIndex: number) => {
    setCart(prev => {
      const item = prev[cartIndex];
      if (item.quantity > 1) {
        return prev.map((i, idx) => idx === cartIndex ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter((_, idx) => idx !== cartIndex);
    });
  }, []);

  const increaseCartItemQuantity = useCallback((cartIndex: number) => {
    setCart(prev => prev.map((i, idx) => idx === cartIndex ? { ...i, quantity: i.quantity + 1 } : i));
  }, []);

  const validateCustomerInfo = useCallback(() => {
    if (!customerInfo.name.trim()) {
      toast.error('Please enter your name');
      return false;
    }
    if (!customerInfo.phone.trim()) {
      toast.error('Please enter your phone number');
      return false;
    }
    const phoneDigits = customerInfo.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Please enter a valid phone number');
      return false;
    }
    const normalizedEmail = customerInfo.email.trim();
    if (normalizedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        toast.error('Please enter a valid email address or leave it blank');
        return false;
      }
    }
    // Validate scheduled pickup time if enabled
    if (customerInfo.scheduleForLater && !customerInfo.scheduledPickupTime) {
      toast.error('Please select a pickup time');
      return false;
    }
    if (customerInfo.scheduleForLater && customerInfo.scheduledPickupTime) {
      const scheduledTime = new Date(customerInfo.scheduledPickupTime);
      const now = new Date();
      const minTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 min from now
      const maxTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days ahead
      
      if (scheduledTime < minTime) {
        toast.error('Scheduled pickup must be at least 15 minutes from now');
        return false;
      }
      if (scheduledTime > maxTime) {
        toast.error('Cannot schedule more than 7 days in advance');
        return false;
      }
    }
    return true;
  }, [customerInfo]);

  const handlePlaceOrder = useCallback(async (taxRate: number = 0, restaurantState: string = '') => {
    if (cart.length === 0) return;
    if (!validateCustomerInfo()) return;

    // Calculate order totals with tax
    const subtotal = cartTotal;
    const tax = taxRate > 0 ? Math.round(cartTotal * taxRate * 100) / 100 : 0;
    const total = subtotal + tax;

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
        customerEmail: customerInfo.email.trim() || null,
        orderType: customerInfo.orderType,
        specialInstructions: customerInfo.specialInstructions.trim() || null,
        paymentMethod,
        marketingConsent,
        taxRate,
        restaurantState,
        subtotal,
        tax,
        total,
        scheduledPickupTime: customerInfo.scheduleForLater ? customerInfo.scheduledPickupTime : null
      });
      const checkoutUrl = resp?.data?.data?.checkoutUrl as string | undefined;
      const selectedPaymentMethod = resp?.data?.data?.paymentMethod as 'pickup' | 'online' | undefined;

      if (selectedPaymentMethod === 'online' && checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }

      setOrderComplete(resp.data.data.orderId);
      setOrderStatus(resp.data.data.status || null);
      setPickupTime(resp.data.data.pickupTime || null);
      setOrderCreatedAt(new Date().toISOString());
      setCart([]);
      setIsCartOpen(false);
      setCheckoutStep('cart');
      setCustomerInfo({ name: '', phone: '', email: '', orderType: 'pickup', specialInstructions: '', scheduleForLater: false, scheduledPickupTime: null });
      setMarketingConsent(false);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error?.message;
      toast.error(typeof errorMessage === 'string' ? errorMessage : 'Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  }, [cart, customerInfo, paymentMethod, marketingConsent, restaurantSlug, validateCustomerInfo, cartTotal]);

  const handleProceedToPayment = useCallback((onlinePaymentsEnabled: boolean) => {
    if (validateCustomerInfo()) {
      if (onlinePaymentsEnabled) {
        setCheckoutStep('payment');
      } else {
        handlePlaceOrder();
      }
    }
  }, [validateCustomerInfo, handlePlaceOrder]);

  return {
    cart,
    isCartOpen,
    setIsCartOpen,
    isSubmitting,
    orderComplete,
    setOrderComplete,
    orderStatus,
    setOrderStatus,
    pickupTime,
    setPickupTime,
    orderCreatedAt,
    setOrderCreatedAt,
    checkoutStep,
    setCheckoutStep,
    customerInfo,
    setCustomerInfo,
    marketingConsent,
    setMarketingConsent,
    paymentMethod,
    setPaymentMethod,
    cartTotal,
    cartItemCount,
    addToCart,
    removeFromCart,
    increaseCartItemQuantity,
    validateCustomerInfo,
    handlePlaceOrder,
    handleProceedToPayment,
  };
}
