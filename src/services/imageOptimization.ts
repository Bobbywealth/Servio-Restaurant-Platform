/**
 * Image Optimization Service
 * Handles image processing, WebP conversion, and optimization
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  effort?: number; // 0-6 for WebP (higher = better compression but slower)
  preserveMetadata?: boolean;
}

export interface OptimizedImageResult {
  filename: string;
  originalSize: number;
  optimizedSize: number;
  format: string;
  width: number;
  height: number;
  url: string;
}

const DEFAULT_OPTIONS: ImageOptimizationOptions = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 80,
  format: 'webp',
  effort: 4,
  preserveMetadata: false
};

/**
 * Optimize an image buffer and convert to WebP
 */
export async function optimizeImage(
  buffer: Buffer,
  options: ImageOptimizationOptions = {}
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  let pipeline = sharp(buffer);
  
  // Get metadata to check if resizing is needed
  const metadata = await pipeline.metadata();
  
  // Resize if needed
  if (metadata.width && metadata.height) {
    if (metadata.width > opts.maxWidth! || metadata.height > opts.maxHeight!) {
      pipeline = pipeline.resize(opts.maxWidth, opts.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
  }
  
  // Remove metadata unless preserving
  if (!opts.preserveMetadata) {
    pipeline = pipeline.withMetadata();
  }
  
  // Convert to target format
  switch (opts.format) {
    case 'webp':
      pipeline = pipeline.webp({
        quality: opts.quality,
        effort: opts.effort
      });
      break;
    case 'jpeg':
      pipeline = pipeline.jpeg({
        quality: opts.quality,
        mozjpeg: true
      });
      break;
    case 'png':
      pipeline = pipeline.png({
        compressionLevel: 9,
        quality: opts.quality
      });
      break;
  }
  
  return pipeline.toBuffer();
}

/**
 * Generate multiple sizes for responsive images
 */
export async function generateResponsiveSizes(
  buffer: Buffer,
  sizes: number[] = [400, 800, 1200],
  options: ImageOptimizationOptions = {}
): Promise<Map<number, Buffer>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const results = new Map<number, Buffer>();
  
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width || 1200;
  
  for (const size of sizes) {
    // Skip if the requested size is larger than original
    if (size > originalWidth) continue;
    
    const resizedBuffer = await sharp(buffer)
      .resize(size, undefined, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({
        quality: opts.quality,
        effort: opts.effort
      })
      .toBuffer();
    
    results.set(size, resizedBuffer);
  }
  
  return results;
}

/**
 * Process uploaded image and save optimized versions
 */
export async function processAndSaveImage(
  buffer: Buffer,
  uploadsDir: string,
  options: ImageOptimizationOptions = {}
): Promise<OptimizedImageResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = buffer.length;
  
  // Generate unique filename
  const imageId = uuidv4();
  const filename = `${imageId}.${opts.format}`;
  const filepath = path.join(uploadsDir, filename);
  
  // Optimize image
  const optimizedBuffer = await optimizeImage(buffer, opts);
  
  // Get dimensions
  const metadata = await sharp(optimizedBuffer).metadata();
  
  // Save to disk
  await fs.writeFile(filepath, optimizedBuffer);
  
  logger.info('Image optimized and saved', {
    filename,
    originalSize,
    optimizedSize: optimizedBuffer.length,
    compressionRatio: ((1 - optimizedBuffer.length / originalSize) * 100).toFixed(1) + '%'
  });
  
  return {
    filename,
    originalSize,
    optimizedSize: optimizedBuffer.length,
    format: opts.format || 'webp',
    width: metadata.width || 0,
    height: metadata.height || 0,
    url: `/uploads/${filename}`
  };
}

/**
 * Process image with multiple responsive sizes
 */
export async function processResponsiveImage(
  buffer: Buffer,
  uploadsDir: string,
  options: ImageOptimizationOptions = {}
): Promise<{
  default: OptimizedImageResult;
  sizes: Map<number, OptimizedImageResult>;
}> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Process default size
  const defaultResult = await processAndSaveImage(buffer, uploadsDir, opts);
  
  // Generate responsive sizes
  const sizes = new Map<number, OptimizedImageResult>();
  const responsiveSizes = [400, 800];
  
  const sizeBuffers = await generateResponsiveSizes(buffer, responsiveSizes, opts);
  
  for (const [size, sizeBuffer] of sizeBuffers) {
    const sizeFilename = defaultResult.filename.replace(
      `.${opts.format}`,
      `-${size}w.${opts.format}`
    );
    const sizeFilepath = path.join(uploadsDir, sizeFilename);
    
    await fs.writeFile(sizeFilepath, sizeBuffer);
    
    const metadata = await sharp(sizeBuffer).metadata();
    
    sizes.set(size, {
      filename: sizeFilename,
      originalSize: buffer.length,
      optimizedSize: sizeBuffer.length,
      format: opts.format || 'webp',
      width: metadata.width || size,
      height: metadata.height || 0,
      url: `/uploads/${sizeFilename}`
    });
  }
  
  return { default: defaultResult, sizes };
}

/**
 * Generate blur placeholder for lazy loading
 */
export async function generateBlurPlaceholder(
  buffer: Buffer
): Promise<string> {
  const blurBuffer = await sharp(buffer)
    .resize(20, 20, { fit: 'inside' })
    .blur(10)
    .webp({ quality: 20 })
    .toBuffer();
  
  return `data:image/webp;base64,${blurBuffer.toString('base64')}`;
}

/**
 * Extract dominant color from image
 */
export async function extractDominantColor(buffer: Buffer): Promise<string> {
  const stats = await sharp(buffer)
    .resize(1, 1)
    .raw()
    .toBuffer();
  
  const [r, g, b] = stats;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Validate image buffer
 */
export async function validateImage(buffer: Buffer): Promise<{
  valid: boolean;
  error?: string;
  metadata?: sharp.Metadata;
}> {
  try {
    const metadata = await sharp(buffer).metadata();
    
    // Check if it's a valid image
    if (!metadata.format) {
      return { valid: false, error: 'Invalid image format' };
    }
    
    // Check dimensions
    if (metadata.width && metadata.width < 10) {
      return { valid: false, error: 'Image too small (minimum 10px width)' };
    }
    if (metadata.height && metadata.height < 10) {
      return { valid: false, error: 'Image too small (minimum 10px height)' };
    }
    
    // Check file size (max 10MB)
    if (buffer.length > 10 * 1024 * 1024) {
      return { valid: false, error: 'Image too large (maximum 10MB)' };
    }
    
    return { valid: true, metadata };
  } catch (error) {
    return { valid: false, error: 'Failed to process image' };
  }
}

/**
 * Delete image and its variants
 */
export async function deleteImageVariants(
  uploadsDir: string,
  baseFilename: string
): Promise<void> {
  try {
    const files = await fs.readdir(uploadsDir);
    const baseName = baseFilename.replace(/\.[^.]+$/, '');
    
    for (const file of files) {
      if (file.startsWith(baseName)) {
        await fs.unlink(path.join(uploadsDir, file));
        logger.info(`Deleted image variant: ${file}`);
      }
    }
  } catch (error) {
    logger.error('Error deleting image variants', { error, baseFilename });
  }
}

/**
 * Middleware factory for image upload with optimization
 */
export function createOptimizedUploadMiddleware(
  uploadsDir: string,
  options: ImageOptimizationOptions = {}
) {
  return async (req: any, res: any, next: any) => {
    if (!req.file) {
      return next();
    }
    
    try {
      const result = await processAndSaveImage(
        req.file.buffer,
        uploadsDir,
        options
      );
      
      // Attach optimized image info to request
      req.optimizedImage = result;
      
      // Update file path to use optimized version
      req.file.filename = result.filename;
      req.file.path = path.join(uploadsDir, result.filename);
      req.file.mimetype = `image/${result.format}`;
      
      next();
    } catch (error) {
      logger.error('Image optimization failed', { error });
      next(error);
    }
  };
}

export default {
  optimizeImage,
  generateResponsiveSizes,
  processAndSaveImage,
  processResponsiveImage,
  generateBlurPlaceholder,
  extractDominantColor,
  validateImage,
  deleteImageVariants,
  createOptimizedUploadMiddleware
};
