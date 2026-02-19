import { useState } from 'react';
import type { ReceiptPaperWidth, ReceiptOrder, ReceiptRestaurant } from '../../utils/receiptGenerator';
import { generateReceiptHtml } from '../../utils/receiptGenerator';

export function useOrderPrinting() {
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);

  const printOrder = async ({
    order,
    restaurant,
    paperWidth,
    headerText,
    footerText,
    fontSize
  }: {
    order: ReceiptOrder;
    restaurant: ReceiptRestaurant | null;
    paperWidth: ReceiptPaperWidth;
    headerText: string;
    footerText: string;
    fontSize: string;
  }) => {
    setPrintingOrderId(order.id);
    setReceiptHtml(
      generateReceiptHtml({
        restaurant,
        order,
        paperWidth,
        headerText,
        footerText,
        fontSize
      })
    );
  };

  return { printingOrderId, receiptHtml, setReceiptHtml, printOrder, setPrintingOrderId };
}
