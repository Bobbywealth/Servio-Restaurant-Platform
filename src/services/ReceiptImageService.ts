/**
 * Receipt Image Analysis Service
 *
 * Uses OpenAI's GPT-4 Vision API to analyze receipt images and extract
 * inventory line items. Can also use MiniMax for text analysis of OCR results.
 *
 * Required environment variables:
 * - OPENAI_API_KEY: For GPT-4 Vision analysis
 * - MINIMAX_API_KEY: Optional fallback for text analysis
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { ensureUploadsDir } from '../utils/uploads';
import { MiniMaxService } from './MiniMaxService';
import { v4 as uuidv4 } from 'uuid';

export interface ReceiptAnalysisItem {
  name: string;
  description?: string;
  quantity: number;
  unit?: string;
  unitCost?: number;
  totalPrice?: number;
  confidence: number; // 0-1 confidence score
  category?: string;
}

export interface ReceiptAnalysisResult {
  id: string;
  supplierName?: string;
  date?: string;
  totalAmount?: number;
  currency?: string;
  items: ReceiptAnalysisItem[];
  rawText?: string;
  analyzedAt: string;
  confidence: number;
}

export interface InventoryItemFromReceipt {
  name: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  category?: string;
}

class ReceiptImageService {
  private openai: OpenAI | null = null;
  private miniMax: MiniMaxService;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    this.miniMax = new MiniMaxService();
  }

  isConfigured(): boolean {
    return Boolean(this.openai) || this.miniMax.isConfigured();
  }

  getProvider(): string {
    if (this.openai) return 'openai';
    if (this.miniMax.isConfigured()) return 'minimax';
    return 'none';
  }

  /**
   * Analyze a receipt image and extract line items
   */
  async analyzeReceiptImage(imagePath: string): Promise<ReceiptAnalysisResult> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured for receipt analysis');
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = this.getMimeType(imagePath);

    logger.info('Analyzing receipt image with GPT-4 Vision', {
      fileSize: imageBuffer.length,
      mimeType
    });

    const result = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a receipt analysis expert. Extract all line items from the receipt image.
Return a JSON object with:
- supplierName: The vendor/store name if visible
- date: The date on the receipt if visible (YYYY-MM-DD format)
- totalAmount: The final total amount
- currency: The currency symbol/code
- items: Array of line items, each with:
  - name: Item/product name (required)
  - description: Additional description if available
  - quantity: Numeric quantity
  - unit: Unit of measure (e.g., "cases", "lbs", "each", "boxes")
  - unitCost: Cost per unit (if available)
  - totalPrice: Line item total (if available)
  - category: Suggested inventory category (e.g., "Produce", "Dairy", "Meat", "Dry Goods", "Beverages", "Supplies")
  - confidence: Your confidence in this extraction (0-1)
- rawText: Full text extracted from receipt
- confidence: Overall analysis confidence (0-1)

Be careful with:
- Partial items (split cases, individual units)
- Tax and discounts
- Multiple quantities at different prices
- Ambiguous item names

If something is unreadable or uncertain, note it in the confidence score.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all line items from this receipt. Be thorough and accurate.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    });

    const content = result.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from OpenAI Vision API');
    }

    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Vision API response');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and clean up the result
      const items: ReceiptAnalysisItem[] = (parsed.items || []).map((item: any) => ({
        name: item.name || 'Unknown Item',
        description: item.description,
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'each',
        unitCost: item.unitCost ? Number(item.unitCost) : undefined,
        totalPrice: item.totalPrice ? Number(item.totalPrice) : undefined,
        confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.5)),
        category: item.category
      }));

      const resultData: ReceiptAnalysisResult = {
        id: uuidv4(),
        supplierName: parsed.supplierName,
        date: parsed.date,
        totalAmount: parsed.totalAmount ? Number(parsed.totalAmount) : undefined,
        currency: parsed.currency || 'USD',
        items,
        rawText: parsed.rawText,
        analyzedAt: new Date().toISOString(),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.7))
      };

      logger.info('Receipt analysis complete', {
        itemCount: items.length,
        supplierName: resultData.supplierName,
        totalAmount: resultData.totalAmount,
        confidence: resultData.confidence
      });

      return resultData;
    } catch (parseError) {
      logger.error('Failed to parse Vision API response', { content: content.substring(0, 500) });
      throw new Error('Failed to parse receipt analysis result');
    }
  }

  /**
   * Analyze text from OCR to extract line items
   * Fallback when image analysis is not available
   */
  async analyzeReceiptText(text: string): Promise<ReceiptAnalysisResult> {
    const provider = this.getProvider();
    
    logger.info('Analyzing receipt text', { provider, textLength: text.length });

    if (provider === 'openai' && this.openai) {
      return this.analyzeReceiptTextWithOpenAI(text);
    } else if (provider === 'minimax') {
      return this.analyzeReceiptTextWithMiniMax(text);
    } else {
      // Basic parsing fallback
      return this.basicTextParsing(text);
    }
  }

  private async analyzeReceiptTextWithOpenAI(text: string): Promise<ReceiptAnalysisResult> {
    const completion = await this.openai!.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a receipt analysis expert. Extract all line items from the receipt text.
Return a JSON object with the same format as the image analysis.
Focus on identifying:
- Vendor/supplier name
- Date
- Individual items with quantities and prices
- Total amount

For each item, suggest an appropriate inventory category based on common restaurant supplies.`
        },
        {
          role: 'user',
          content: `Extract line items from this receipt text:\n\n${text}`
        }
      ],
      max_tokens: 1500,
      temperature: 0.1
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    return this.parseAIResponse(content);
  }

  private async analyzeReceiptTextWithMiniMax(text: string): Promise<ReceiptAnalysisResult> {
    const response = await this.miniMax.chat([
      {
        role: 'system',
        content: `You are a receipt analysis expert. Extract all line items from the receipt text.
Return ONLY valid JSON with this structure:
{
  "supplierName": "vendor name or null",
  "date": "YYYY-MM-DD or null",
  "totalAmount": total or null,
  "currency": "USD",
  "items": [
    {
      "name": "item name",
      "description": "optional description",
      "quantity": numeric quantity,
      "unit": "unit of measure",
      "unitCost": price per unit or null,
      "totalPrice": line total or null,
      "category": "suggested category",
      "confidence": 0.0-1.0
    }
  ],
  "confidence": overall confidence 0-1
}`
      },
      {
        role: 'user',
        content: `Extract line items from this receipt:\n\n${text}`
      }
    ], undefined, 0.1);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from MiniMax');
    }

    return this.parseAIResponse(content);
  }

  private parseAIResponse(content: string): ReceiptAnalysisResult {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from AI response');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      
      const items: ReceiptAnalysisItem[] = (parsed.items || []).map((item: any) => ({
        name: item.name || 'Unknown Item',
        description: item.description,
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'each',
        unitCost: item.unitCost ? Number(item.unitCost) : undefined,
        totalPrice: item.totalPrice ? Number(item.totalPrice) : undefined,
        confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.5)),
        category: item.category
      }));

      return {
        id: uuidv4(),
        supplierName: parsed.supplierName,
        date: parsed.date,
        totalAmount: parsed.totalAmount ? Number(parsed.totalAmount) : undefined,
        currency: parsed.currency || 'USD',
        items,
        rawText: typeof parsed.rawText === 'string' ? parsed.rawText : undefined,
        analyzedAt: new Date().toISOString(),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.6))
      };
    } catch (parseError) {
      logger.error('Failed to parse AI response', { content: content.substring(0, 500) });
      throw new Error('Failed to parse receipt analysis result');
    }
  }

  /**
   * Basic text parsing as fallback when AI is not available
   */
  private basicTextParsing(text: string): ReceiptAnalysisResult {
    const lines = text.split('\n').filter(line => line.trim());
    const items: ReceiptAnalysisItem[] = [];
    
    // Simple regex patterns for common receipt formats
    const pricePattern = /[\$£€]?\s*(\d+[.,]\d{2})/;
    
    for (const line of lines) {
      const priceMatch = line.match(pricePattern);
      if (priceMatch) {
        items.push({
          name: line.replace(priceMatch[0], '').trim().substring(0, 100) || 'Unknown Item',
          quantity: 1,
          unit: 'each',
          totalPrice: parseFloat(priceMatch[1].replace(',', '.')),
          confidence: 0.3 // Low confidence for basic parsing
        });
      }
    }

    return {
      id: uuidv4(),
      items,
      analyzedAt: new Date().toISOString(),
      confidence: 0.3
    };
  }

  /**
   * Save uploaded image and return the path
   */
  async saveUploadedImage(
    imageBuffer: Buffer,
    originalName: string,
    restaurantId: string
  ): Promise<{ path: string; url: string }> {
    const uploadDir = await ensureUploadsDir('receipts');
    const ext = path.extname(originalName).toLowerCase() || '.jpg';
    const fileName = `${uuidv4()}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    await fs.promises.writeFile(filePath, imageBuffer);

    const url = `/uploads/receipts/${fileName}`;

    logger.info('Receipt image saved', {
      path: filePath,
      url,
      size: imageBuffer.length
    });

    return { path: filePath, url };
  }

  /**
   * Convert analysis result to inventory items ready for insertion
   */
  convertToInventoryItems(
    analysis: ReceiptAnalysisResult,
    existingInventory: any[]
  ): InventoryItemFromReceipt[] {
    return analysis.items.map(item => {
      // Try to match with existing inventory for better unit detection
      const existingMatch = existingInventory.find(
        inv => inv.name.toLowerCase() === item.name.toLowerCase()
      );

      return {
        name: item.name,
        quantity: item.quantity,
        unit: existingMatch?.unit || item.unit || 'each',
        unitCost: item.unitCost,
        category: item.category || existingMatch?.category
      };
    });
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }
}

export const receiptImageService = new ReceiptImageService();
export default receiptImageService;
