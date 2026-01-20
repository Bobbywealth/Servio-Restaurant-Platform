import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../utils/logger';

export interface StorageAdapter {
  getUploadUrl(key: string, contentType: string, expiresSuffix?: number): Promise<string>;
  getDownloadUrl(key: string, expiresSuffix?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

export class S3StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const region = process.env.STORAGE_REGION || 'us-east-1';
    const accessKeyId = process.env.STORAGE_ACCESS_KEY;
    const secretAccessKey = process.env.STORAGE_SECRET_KEY;
    this.bucket = process.env.STORAGE_BUCKET || 'servio-receipts';

    const config: any = {
      region,
    };

    if (accessKeyId && secretAccessKey) {
      config.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    }

    // Support for S3-compatible services (Supabase, DigitalOcean, etc.)
    if (process.env.STORAGE_ENDPOINT) {
      config.endpoint = process.env.STORAGE_ENDPOINT;
      config.forcePathStyle = true; // Often required for non-AWS S3
    }

    this.client = new S3Client(config);
  }

  async getUploadUrl(key: string, contentType: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });
      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      logger.error('Error generating upload URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      logger.error('Error generating download URL:', error);
      throw new Error('Failed to generate download URL');
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
    } catch (error) {
      logger.error('Error deleting object from storage:', error);
      throw new Error('Failed to delete storage object');
    }
  }
}

export enum StorageProvider {
  S3 = 's3',
  LOCAL = 'local', // For development if needed, but we'll default to S3
}

export class StorageService {
  private static instance: StorageService;
  private adapter: StorageAdapter;

  private constructor() {
    const provider = (process.env.STORAGE_PROVIDER || StorageProvider.S3) as StorageProvider;
    
    switch (provider) {
      case StorageProvider.S3:
        this.adapter = new S3StorageAdapter();
        break;
      default:
        this.adapter = new S3StorageAdapter();
    }
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public getAdapter(): StorageAdapter {
    return this.adapter;
  }

  /**
   * Helper to generate a standardized key for receipts
   * format: receipts/{restaurant_id}/{year}/{month}/{uuid}_{filename}
   */
  public generateReceiptKey(restaurantId: string, filename: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const uuid = Math.random().toString(36).substring(2, 15);
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    return `receipts/${restaurantId}/${year}/${month}/${uuid}_${sanitizedFilename}`;
  }
}
