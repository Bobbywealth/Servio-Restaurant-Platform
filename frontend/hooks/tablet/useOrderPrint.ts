/**
 * useOrderPrint Hook
 * 
 * Custom hook for managing print functionality.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { safeLocalStorage } from '@/lib/utils';
import type { ReceiptPaperWidth, ReceiptRestaurant } from '@/utils/receiptGenerator';
import { generateReceiptHtml, generateStandaloneReceiptHtml, getReceiptItemModifiers } from '@/utils/receiptGenerator';
import { generatePlainTextReceipt, printViaRawBT } from '@/utils/escpos';
import { api } from '@/lib/api';
import { STORAGE_KEYS, type PaperWidth, type FontSize } from '@/components/tablet/orders/constants';

interface UseOrderPrintProps {
  restaurantProfile?: ReceiptRestaurant | null;
  onRestaurantProfileChange?: (profile: ReceiptRestaurant | null) => void;
}

interface UseOrderPrintReturn {
  // State
  autoPrintEnabled: boolean;
  setAutoPrintEnabled: (enabled: boolean) => void;
  paperWidth: PaperWidth;
  setPaperWidth: (width: PaperWidth) => void;
  printMode: 'bluetooth' | 'system' | 'bridge' | 'rawbt';
  setPrintMode: (mode: 'bluetooth' | 'system' | 'bridge' | 'rawbt') => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  headerText: string;
  setHeaderText: (text: string) => void;
  footerText: string;
  setFooterText: (text: string) => void;
  printingOrderId: string | null;
  lastPrintResult: { status: 'success' | 'error'; message?: string } | null;
  receiptHtml: string | null;
  setReceiptHtml: (html: string | null) => void;
  
  // Actions
  printOrder: (orderId: string, opts?: { markAsPrinted?: boolean }) => Promise<void>;
  printTestReceipt: () => Promise<void>;
  fetchRestaurantProfile: () => Promise<void>;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await api.get(path);
  return res.data as T;
}

export function useOrderPrint({
  restaurantProfile,
  onRestaurantProfileChange,
}: UseOrderPrintProps = {}): UseOrderPrintReturn {
  const [autoPrintEnabled, setAutoPrintEnabled] = useState<boolean>(false);
  const [paperWidth, setPaperWidth] = useState<PaperWidth>('80mm');
  const [printMode, setPrintMode] = useState<'bluetooth' | 'system' | 'bridge' | 'rawbt'>('system');
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [headerText, setHeaderText] = useState<string>('');
  const [footerText, setFooterText] = useState<string>('');
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [lastPrintResult, setLastPrintResult] = useState<{ status: 'success' | 'error'; message?: string } | null>(null);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);
  const [localRestaurantProfile, setLocalRestaurantProfile] = useState<ReceiptRestaurant | null>(restaurantProfile || null);

  // Sync local profile with prop
  useEffect(() => {
    if (restaurantProfile !== undefined) {
      setLocalRestaurantProfile(restaurantProfile);
    }
  }, [restaurantProfile]);

  // Load settings from storage and API
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const storedAuto = safeLocalStorage.getItem(STORAGE_KEYS.autoPrintEnabled);
    const auto = storedAuto === 'true';
    setAutoPrintEnabled(auto);

    const storedPaper = safeLocalStorage.getItem(STORAGE_KEYS.paperWidth);
    if (storedPaper === '58mm' || storedPaper === '80mm') {
      setPaperWidth(storedPaper);
    }

    const storedMode = safeLocalStorage.getItem(STORAGE_KEYS.printMode);
    if (storedMode === 'bluetooth' || storedMode === 'bridge' || storedMode === 'system' || storedMode === 'rawbt') {
      setPrintMode(storedMode);
    }

    const storedFontSize = safeLocalStorage.getItem(STORAGE_KEYS.fontSize);
    if (storedFontSize === 'small' || storedFontSize === 'medium' || storedFontSize === 'large' || storedFontSize === 'xlarge') {
      setFontSize(storedFontSize);
    }

    const storedResult = safeLocalStorage.getItem(STORAGE_KEYS.lastPrintResult);
    if (storedResult) {
      try {
        setLastPrintResult(JSON.parse(storedResult));
      } catch {
        // ignore
      }
    }
  }, []);

  // Fetch restaurant profile from API
  const fetchRestaurantProfile = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && !safeLocalStorage.getItem('servio_access_token')) {
        return;
      }
      const json = await apiGet<{ success: boolean; data?: any }>('/api/restaurant/profile');
      if (json?.success && json.data) {
        const profile: ReceiptRestaurant = {
          name: json.data.name,
          phone: json.data.phone,
          address: json.data.address,
          logo_url: json.data.logo_url
        };
        setLocalRestaurantProfile(profile);
        onRestaurantProfileChange?.(profile);
      }
    } catch (e) {
      console.warn('Failed to load restaurant profile for printing', e);
    }
  }, [onRestaurantProfileChange]);

  // Update auto-print setting
  const handleSetAutoPrintEnabled = useCallback((enabled: boolean) => {
    setAutoPrintEnabled(enabled);
    safeLocalStorage.setItem(STORAGE_KEYS.autoPrintEnabled, enabled ? 'true' : 'false');
  }, []);

  // Update paper width
  const handleSetPaperWidth = useCallback((width: PaperWidth) => {
    setPaperWidth(width);
    safeLocalStorage.setItem(STORAGE_KEYS.paperWidth, width);
  }, []);

  // Update print mode
  const handleSetPrintMode = useCallback((mode: 'bluetooth' | 'system' | 'bridge' | 'rawbt') => {
    setPrintMode(mode);
    safeLocalStorage.setItem(STORAGE_KEYS.printMode, mode);
  }, []);

  // Update font size
  const handleSetFontSize = useCallback((size: FontSize) => {
    setFontSize(size);
    safeLocalStorage.setItem(STORAGE_KEYS.fontSize, size);
  }, []);

  // Print order
  const printOrder = useCallback(async (orderId: string, opts?: { markAsPrinted?: boolean }) => {
    if (printingOrderId) {
      console.log('Print already in progress, ignoring');
      return;
    }
    
    setPrintingOrderId(orderId);
    try {
      const full = await apiGet<{ success: boolean; data?: any }>(`/api/orders/${encodeURIComponent(orderId)}`);
      const order = (full?.data || full);

      let restaurant = localRestaurantProfile;
      if (!restaurant) {
        await fetchRestaurantProfile();
        restaurant = localRestaurantProfile;
      }

      if (printMode === 'rawbt') {
        const items = (order.items || []).map((it: any) => ({
          name: it.name || 'Item',
          quantity: it.quantity || 1,
          price: it.unit_price || it.price || 0,
          modifiers: getReceiptItemModifiers(it)
        }));

        const orderAny = order as any;
        const plainText = generatePlainTextReceipt({
          restaurantName: restaurant?.name || undefined,
          restaurantPhone: restaurant?.phone || undefined,
          restaurantAddress: restaurant?.address || undefined,
          orderId: order.id,
          orderNumber: orderAny.external_id?.slice(-4).toUpperCase() || order.id.slice(-4).toUpperCase(),
          customerName: order.customer_name || undefined,
          customerPhone: orderAny.customer_phone || undefined,
          orderType: orderAny.order_type || undefined,
          items,
          subtotal: orderAny.subtotal || undefined,
          tax: orderAny.tax || undefined,
          total: order.total_amount || 0,
          pickupTime: orderAny.pickup_time || undefined,
          createdAt: order.created_at || undefined,
          specialInstructions: orderAny.special_instructions || undefined,
          headerText: headerText || undefined,
          footerText: footerText || undefined
        }, paperWidth);
        
        const success = printViaRawBT(plainText);

        if (success) {
          setLastPrintResult({ status: 'success' });
          safeLocalStorage.setItem(STORAGE_KEYS.lastPrintResult, JSON.stringify({ status: 'success' }));
        } else {
          setLastPrintResult({ status: 'error', message: 'RawBT not available. Is the app installed?' });
          safeLocalStorage.setItem(STORAGE_KEYS.lastPrintResult, JSON.stringify({ status: 'error', message: 'RawBT not available' }));
        }
        return;
      }

      if (printMode === 'system') {
        const standaloneHtml = generateStandaloneReceiptHtml({
          restaurant: restaurant || null,
          order: order as any,
          paperWidth,
          headerText,
          footerText,
          fontSize
        });

        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
          printWindow.document.write(standaloneHtml);
          printWindow.document.close();
          printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
          };
        } else {
          setReceiptHtml(generateReceiptHtml({
            restaurant: restaurant || null,
            order: order as any,
            paperWidth, headerText, footerText, fontSize
          }));
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          window.print();
        }

        setLastPrintResult({ status: 'success' });
        safeLocalStorage.setItem(STORAGE_KEYS.lastPrintResult, JSON.stringify({ status: 'success' }));
        return;
      }

      const message = printMode === 'bluetooth'
        ? 'WebBluetooth mode requires BLE printer. Try RawBT or System Print instead.'
        : 'Print Bridge mode is not configured';
      setLastPrintResult({ status: 'error', message });
      safeLocalStorage.setItem(STORAGE_KEYS.lastPrintResult, JSON.stringify({ status: 'error', message }));

    } catch (e) {
      console.error('Print failed', e);
      const message = e instanceof Error ? e.message : 'Print failed';
      setLastPrintResult({ status: 'error', message });
      safeLocalStorage.setItem(STORAGE_KEYS.lastPrintResult, JSON.stringify({ status: 'error', message }));
    } finally {
      setPrintingOrderId(null);
      window.setTimeout(() => setReceiptHtml(null), 250);
    }
  }, [printingOrderId, localRestaurantProfile, fetchRestaurantProfile, printMode, paperWidth, headerText, footerText, fontSize]);

  // Print test receipt
  const printTestReceipt = useCallback(async () => {
    if (printingOrderId) return;
    setPrintingOrderId('test');

    try {
      let restaurant = localRestaurantProfile;
      if (!restaurant) {
        await fetchRestaurantProfile();
        restaurant = localRestaurantProfile;
      }

      const now = new Date();
      const testOrder: any = {
        id: `test_${now.getTime()}`,
        external_id: 'TEST',
        channel: 'POS',
        status: 'received',
        customer_name: 'Test Customer',
        customer_phone: '(555) 123-4567',
        order_type: 'pickup',
        created_at: now.toISOString(),
        items: [
          { name: 'Test Burger', quantity: 1, price: 9.99, modifiers: ['No onions', 'Extra cheese'] },
          { name: 'Fries', quantity: 1, price: 3.49 },
          { name: 'Soda', quantity: 2, price: 1.75 }
        ],
        special_instructions: 'Test print from dashboard'
      };

      if (printMode === 'rawbt') {
        const plainText = generatePlainTextReceipt({
          restaurantName: restaurant?.name || undefined,
          restaurantPhone: restaurant?.phone || undefined,
          restaurantAddress: restaurant?.address || undefined,
          orderId: testOrder.id,
          orderNumber: testOrder.external_id || testOrder.id.slice(-4).toUpperCase(),
          customerName: testOrder.customer_name || undefined,
          customerPhone: testOrder.customer_phone || undefined,
          orderType: testOrder.order_type || undefined,
          items: (testOrder.items || []).map((it: any) => ({
            name: it.name,
            quantity: it.quantity || 1,
            price: it.unit_price || it.price || 0,
            modifiers: getReceiptItemModifiers(it)
          })),
          total: (testOrder.items || []).reduce((sum: number, it: any) => {
            const qty = it.quantity || 1;
            const price = it.unit_price || it.price || 0;
            return sum + qty * price;
          }, 0),
          createdAt: testOrder.created_at || undefined,
          specialInstructions: testOrder.special_instructions || undefined,
          headerText: headerText || undefined,
          footerText: footerText || undefined
        }, paperWidth);
        
        const success = printViaRawBT(plainText);
        if (success) {
          setLastPrintResult({ status: 'success' });
          safeLocalStorage.setItem(STORAGE_KEYS.lastPrintResult, JSON.stringify({ status: 'success' }));
        } else {
          setLastPrintResult({ status: 'error', message: 'RawBT not available. Is the app installed?' });
          safeLocalStorage.setItem(STORAGE_KEYS.lastPrintResult, JSON.stringify({ status: 'error', message: 'RawBT not available' }));
        }
        return;
      }

      if (printMode === 'system') {
        const standaloneHtml = generateStandaloneReceiptHtml({
          restaurant: restaurant || null,
          order: testOrder,
          paperWidth,
          headerText,
          footerText,
          fontSize
        });

        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
          printWindow.document.write(standaloneHtml);
          printWindow.document.close();
          printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
          };
        } else {
          setReceiptHtml(generateReceiptHtml({
            restaurant: restaurant || null, order: testOrder,
            paperWidth, headerText, footerText, fontSize
          }));
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          window.print();
        }
        setLastPrintResult({ status: 'success' });
        safeLocalStorage.setItem(STORAGE_KEYS.lastPrintResult, JSON.stringify({ status: 'success' }));
        return;
      }

      const message = printMode === 'bluetooth'
        ? 'WebBluetooth mode requires BLE printer. Try RawBT or System Print instead.'
        : 'Print Bridge mode is not configured';
      setLastPrintResult({ status: 'error', message });
      safeLocalStorage.setItem(STORAGE_KEYS.lastPrintResult, JSON.stringify({ status: 'error', message }));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Test print failed';
      setLastPrintResult({ status: 'error', message });
      safeLocalStorage.setItem(STORAGE_KEYS.lastPrintResult, JSON.stringify({ status: 'error', message }));
    } finally {
      setPrintingOrderId(null);
      window.setTimeout(() => setReceiptHtml(null), 250);
    }
  }, [printingOrderId, localRestaurantProfile, fetchRestaurantProfile, printMode, paperWidth, headerText, footerText, fontSize]);

  return {
    // State
    autoPrintEnabled,
    setAutoPrintEnabled: handleSetAutoPrintEnabled,
    paperWidth,
    setPaperWidth: handleSetPaperWidth,
    printMode,
    setPrintMode: handleSetPrintMode,
    fontSize,
    setFontSize: handleSetFontSize,
    headerText,
    setHeaderText,
    footerText,
    setFooterText,
    printingOrderId,
    lastPrintResult,
    receiptHtml,
    setReceiptHtml,
    
    // Actions
    printOrder,
    printTestReceipt,
    fetchRestaurantProfile,
  };
}
