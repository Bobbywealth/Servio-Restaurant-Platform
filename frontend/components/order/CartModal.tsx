import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Plus, Minus, Loader2, CheckCircle2,
  CreditCard, Wallet, AlertTriangle, User, Phone, Mail
} from 'lucide-react';
import type { CartItem, CustomerInfo, CheckoutStep } from './types';

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  cartTotal: number;
  checkoutStep: CheckoutStep;
  setCheckoutStep: (step: CheckoutStep) => void;
  customerInfo: CustomerInfo;
  setCustomerInfo: (info: CustomerInfo | ((prev: CustomerInfo) => CustomerInfo)) => void;
  marketingConsent: boolean;
  setMarketingConsent: (v: boolean) => void;
  paymentMethod: 'pickup' | 'online';
  setPaymentMethod: (v: 'pickup' | 'online') => void;
  onlinePaymentsEnabled: boolean;
  isSubmitting: boolean;
  onRemoveItem: (index: number) => void;
  onIncreaseItem: (index: number) => void;
  onProceedToPayment: (onlinePaymentsEnabled: boolean) => void;
  onPlaceOrder: () => void;
}

export function CartModal({
  isOpen,
  onClose,
  cart,
  cartTotal,
  checkoutStep,
  setCheckoutStep,
  customerInfo,
  setCustomerInfo,
  marketingConsent,
  setMarketingConsent,
  paymentMethod,
  setPaymentMethod,
  onlinePaymentsEnabled,
  isSubmitting,
  onRemoveItem,
  onIncreaseItem,
  onProceedToPayment,
  onPlaceOrder,
}: CartModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={() => { onClose(); setCheckoutStep('cart'); }}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            className="fixed bottom-0 left-0 right-0 w-full bg-white rounded-t-3xl z-[70] overflow-hidden gpu-accelerated will-change-transform"
            style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 2rem)' }}
          >
            <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 2rem)' }}>
              <div className="max-w-xl mx-auto px-5 sm:px-6 pt-6">
                <div className="flex justify-center mb-4">
                  <div className="w-10 h-1 bg-slate-300 rounded-full" />
                </div>

                {checkoutStep === 'cart' && (
                  <CartReviewStep
                    cart={cart}
                    cartTotal={cartTotal}
                    onClose={onClose}
                    onRemoveItem={onRemoveItem}
                    onIncreaseItem={onIncreaseItem}
                    onContinue={() => setCheckoutStep('details')}
                  />
                )}

                {checkoutStep === 'details' && (
                  <CustomerDetailsStep
                    customerInfo={customerInfo}
                    setCustomerInfo={setCustomerInfo}
                    marketingConsent={marketingConsent}
                    setMarketingConsent={setMarketingConsent}
                    cartTotal={cartTotal}
                    isSubmitting={isSubmitting}
                    onlinePaymentsEnabled={onlinePaymentsEnabled}
                    onBack={() => setCheckoutStep('cart')}
                    onProceed={() => onProceedToPayment(onlinePaymentsEnabled)}
                  />
                )}

                {checkoutStep === 'payment' && (
                  <PaymentStep
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
                    cartTotal={cartTotal}
                    isSubmitting={isSubmitting}
                    onBack={() => setCheckoutStep('details')}
                    onPlaceOrder={onPlaceOrder}
                  />
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function CartReviewStep({
  cart, cartTotal, onClose, onRemoveItem, onIncreaseItem, onContinue
}: {
  cart: CartItem[];
  cartTotal: number;
  onClose: () => void;
  onRemoveItem: (i: number) => void;
  onIncreaseItem: (i: number) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl sm:text-2xl font-bold">Your Order</h2>
        <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 font-bold">Close</button>
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
              <button onClick={() => onRemoveItem(index)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"><Minus className="w-4 h-4" /></button>
              <span className="font-bold w-8 text-center">{item.quantity}</span>
              <button onClick={() => onIncreaseItem(index)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"><Plus className="w-4 h-4" /></button>
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

      <div style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <button
          onClick={onContinue}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl text-base sm:text-lg font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          Continue to Checkout
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </>
  );
}

function CustomerDetailsStep({
  customerInfo, setCustomerInfo, marketingConsent, setMarketingConsent,
  cartTotal, isSubmitting, onlinePaymentsEnabled, onBack, onProceed
}: {
  customerInfo: CustomerInfo;
  setCustomerInfo: (info: CustomerInfo | ((prev: CustomerInfo) => CustomerInfo)) => void;
  marketingConsent: boolean;
  setMarketingConsent: (v: boolean) => void;
  cartTotal: number;
  isSubmitting: boolean;
  onlinePaymentsEnabled: boolean;
  onBack: () => void;
  onProceed: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200">
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
            onChange={(e) => setCustomerInfo((prev: CustomerInfo) => ({ ...prev, name: e.target.value }))}
            onFocus={(e) => { setTimeout(() => { e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300); }}
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
            onChange={(e) => setCustomerInfo((prev: CustomerInfo) => ({ ...prev, phone: e.target.value }))}
            onFocus={(e) => { setTimeout(() => { e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300); }}
            placeholder="(555) 123-4567"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-lg scroll-mt-24"
          />
          <p className="text-sm text-gray-500 mt-1">We'll text you when your order is ready</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <Mail className="w-4 h-4 inline mr-2" />
            Email (optional)
          </label>
          <input
            type="email"
            inputMode="email"
            value={customerInfo.email}
            onChange={(e) => setCustomerInfo((prev: CustomerInfo) => ({ ...prev, email: e.target.value }))}
            onFocus={(e) => { setTimeout(() => { e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300); }}
            placeholder="you@example.com"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-lg scroll-mt-24"
          />
          <p className="text-sm text-gray-500 mt-1">We'll email your order confirmation if you provide this.</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Order Type</label>
          <div className="flex gap-3">
            <button
              onClick={() => setCustomerInfo((prev: CustomerInfo) => ({ ...prev, orderType: 'pickup' }))}
              className={`flex-1 py-3 px-4 rounded-xl border-2 font-semibold transition-all ${
                customerInfo.orderType === 'pickup'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              Pickup
            </button>
            <button
              onClick={() => setCustomerInfo((prev: CustomerInfo) => ({ ...prev, orderType: 'dine-in' }))}
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
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Special Instructions (optional)
          </label>
          <textarea
            value={customerInfo.specialInstructions}
            onChange={(e) => setCustomerInfo((prev: CustomerInfo) => ({ ...prev, specialInstructions: e.target.value }))}
            onFocus={(e) => { setTimeout(() => { e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300); }}
            placeholder="Allergies, dietary requests, etc."
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none resize-none text-sm scroll-mt-24"
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="relative flex items-center pt-0.5">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="w-5 h-5 text-blue-600 border-2 border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
              />
            </div>
            <div className="flex-1">
              <span className="text-sm text-gray-800 font-medium leading-snug">
                I agree to receive text messages about my order status, promotions, and special offers from this restaurant.
              </span>
              <p className="text-xs text-gray-500 mt-1">
                Message and data rates may apply. You can opt out at any time by replying STOP to any message.
              </p>
            </div>
          </label>
        </div>
      </div>

      <div className="border-t pt-4 mb-4">
        <div className="flex justify-between items-center text-lg font-bold">
          <span>Order Total</span>
          <span>${cartTotal.toFixed(2)}</span>
        </div>
      </div>

      <div style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <button
          disabled={isSubmitting}
          onClick={onProceed}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl text-base sm:text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
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
      </div>
    </>
  );
}

function PaymentStep({
  paymentMethod, setPaymentMethod, cartTotal, isSubmitting, onBack, onPlaceOrder
}: {
  paymentMethod: 'pickup' | 'online';
  setPaymentMethod: (v: 'pickup' | 'online') => void;
  cartTotal: number;
  isSubmitting: boolean;
  onBack: () => void;
  onPlaceOrder: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200">
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
          {paymentMethod === 'pickup' && <CheckCircle2 className="w-6 h-6 text-blue-600" />}
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
          {paymentMethod === 'online' && <CheckCircle2 className="w-6 h-6 text-blue-600" />}
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

      <div style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <button
          disabled={isSubmitting || paymentMethod === 'online'}
          onClick={onPlaceOrder}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl text-base sm:text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
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
      </div>
    </>
  );
}
