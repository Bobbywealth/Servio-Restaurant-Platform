import path from 'path';
import fs from 'fs/promises';
import { logger } from './logger';

/**
 * UPLOADS_DIR: Configurable uploads directory
 * 
 * For local development: defaults to process.cwd()/uploads
 * For Render with persistent disk: set UPLOADS_DIR=/var/data/uploads (or your mount path)
 * 
 * Example Render setup:
 * 1. Add a Disk to your service (e.g., mounted at /var/data)
 * 2. Set UPLOADS_DIR=/var/data/uploads in environment variables
 */
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

/**
 * Get the full path for an uploads subdirectory
 */
export function getUploadsPath(...subPaths: string[]): string {
  return path.join(UPLOADS_DIR, ...subPaths);
}

/**
 * Ensure an uploads subdirectory exists
 */
export async function ensureUploadsDir(...subPaths: string[]): Promise<string> {
  const dirPath = getUploadsPath(...subPaths);
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
    logger.info(`Created uploads directory: ${dirPath}`);
  }
  return dirPath;
}

/**
 * Check if uploads directory is accessible and writable
 */
export async function checkUploadsHealth(): Promise<{ ok: boolean; path: string; error?: string }> {
  try {
    await ensureUploadsDir();
    // Try to write a test file
    const testFile = getUploadsPath('.health-check');
    await fs.writeFile(testFile, new Date().toISOString());
    await fs.unlink(testFile);
    return { ok: true, path: UPLOADS_DIR };
  } catch (error) {
    return { 
      ok: false, 
      path: UPLOADS_DIR, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
