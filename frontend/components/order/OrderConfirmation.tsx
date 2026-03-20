import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface OrderConfirmationProps {
  orderId: string;
  orderStatus: string | null;
  pickupTime: string | null;
  orderCreatedAt?: string | null;
  onNewOrder: () => void;
}

// Expected max wait time for restaurant approval (in seconds)
const APPROVAL_TIMEOUT_SECONDS = 180; // 3 minutes

function ApprovalTimer({ createdAt, status }: { createdAt: string | null | undefined; status: string | null }) {
  const [elapsed, setElapsed] = useState(0);
  const normalizedStatus = (status || '').toLowerCase();
  const isApproved = normalizedStatus === 'preparing' || normalizedStatus === 'ready' || normalizedStatus === 'completed';
  const isRejected = normalizedStatus === 'cancelled' || normalizedStatus === 'canceled' || normalizedStatus === 'declined';

  useEffect(() => {
    if (!createdAt || isApproved || isRejected) return;

    const startTime = new Date(createdAt).getTime();
    const updateElapsed = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [createdAt, isApproved, isRejected]);

  if (isApproved || isRejected) return null;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const remaining = APPROVAL_TIMEOUT_SECONDS - elapsed;
  const isOverdue = remaining <= 0;
  const isWarning = remaining <= 60 && remaining > 0;

  return (
    <div className={`border-t pt-4 mt-4 ${isOverdue ? 'border-red-200' : isWarning ? 'border-amber-200' : 'border-gray-200'}`}>
      <div className="flex items-center gap-2 mb-2">
        {isOverdue ? (
          <AlertTriangle className="h-4 w-4 text-red-500" />
        ) : (
          <Clock className="h-4 w-4 text-gray-400" />
        )}
        <span className="text-sm text-gray-500 uppercase tracking-widest">Awaiting Restaurant Approval</span>
      </div>
      <div className={`text-2xl font-mono font-bold ${isOverdue ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-gray-900'}`}>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </div>
      {isOverdue && (
        <p className="text-xs text-red-500 mt-1">Restaurant is taking longer than expected...</p>
      )}
    </div>
  );
}

export function OrderConfirmation({ orderId, orderStatus, pickupTime, orderCreatedAt, onNewOrder }: OrderConfirmationProps) {
  const normalizedStatus = (orderStatus || '').toLowerCase();
  const isCancelled = normalizedStatus === 'cancelled' || normalizedStatus === 'canceled' || normalizedStatus === 'declined';
  const headline = isCancelled ? 'Order Cancelled' : 'Order Confirmed!';
  const subcopy = isCancelled
    ? 'Your order was declined by the restaurant.'
    : 'Thank you for your order';

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-4 sm:p-6 py-12 text-center bg-gradient-to-b safe-area-inset-left safe-area-inset-right ${isCancelled ? 'from-red-50 to-white' : 'from-green-50 to-white'}`}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
      >
        <CheckCircle2 className={`h-20 w-20 sm:h-24 sm:w-24 mb-6 ${isCancelled ? 'text-red-500' : 'text-green-500'}`} />
      </motion.div>
      <h1 className="text-3xl sm:text-4xl font-bold mb-2">{headline}</h1>
      <p className="text-lg sm:text-xl text-gray-600 mb-6">{subcopy}</p>

      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 w-full max-w-sm">
        <div className="text-sm text-gray-500 uppercase tracking-widest mb-1">Order Number</div>
        <div className="text-3xl font-mono font-bold text-blue-600 mb-4">
          #{orderId.slice(-6).toUpperCase()}
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
              isCancelled ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {orderStatus}
            </div>
          </div>
        )}

        {/* Approval Timer - shows elapsed time waiting for restaurant to approve */}
        <ApprovalTimer createdAt={orderCreatedAt} status={orderStatus} />
      </div>

      {!isCancelled && (
        <p className="text-gray-500 mb-6 max-w-sm">
          We'll send you a text when your order is ready for pickup!
        </p>
      )}

      <button
        onClick={onNewOrder}
        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-lg"
      >
        Place Another Order
      </button>
    </div>
  );
}
