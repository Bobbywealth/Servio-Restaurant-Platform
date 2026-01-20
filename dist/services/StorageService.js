"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = exports.StorageProvider = exports.S3StorageAdapter = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const logger_1 = require("../utils/logger");
class S3StorageAdapter {
    constructor() {
        const region = process.env.STORAGE_REGION || 'us-east-1';
        const accessKeyId = process.env.STORAGE_ACCESS_KEY;
        const secretAccessKey = process.env.STORAGE_SECRET_KEY;
        this.bucket = process.env.STORAGE_BUCKET || 'servio-receipts';
        const config = {
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
        this.client = new client_s3_1.S3Client(config);
    }
    async getUploadUrl(key, contentType, expiresIn = 3600) {
        try {
            const command = new client_s3_1.PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                ContentType: contentType,
            });
            return await (0, s3_request_presigner_1.getSignedUrl)(this.client, command, { expiresIn });
        }
        catch (error) {
            logger_1.logger.error('Error generating upload URL:', error);
            throw new Error('Failed to generate upload URL');
        }
    }
    async getDownloadUrl(key, expiresIn = 3600) {
        try {
            const command = new client_s3_1.GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
            });
            return await (0, s3_request_presigner_1.getSignedUrl)(this.client, command, { expiresIn });
        }
        catch (error) {
            logger_1.logger.error('Error generating download URL:', error);
            throw new Error('Failed to generate download URL');
        }
    }
    async deleteObject(key) {
        try {
            const command = new client_s3_1.DeleteObjectCommand({
                Bucket: this.bucket,
                Key: key,
            });
            await this.client.send(command);
        }
        catch (error) {
            logger_1.logger.error('Error deleting object from storage:', error);
            throw new Error('Failed to delete storage object');
        }
    }
}
exports.S3StorageAdapter = S3StorageAdapter;
var StorageProvider;
(function (StorageProvider) {
    StorageProvider["S3"] = "s3";
    StorageProvider["LOCAL"] = "local";
})(StorageProvider || (exports.StorageProvider = StorageProvider = {}));
class StorageService {
    constructor() {
        const provider = (process.env.STORAGE_PROVIDER || StorageProvider.S3);
        switch (provider) {
            case StorageProvider.S3:
                this.adapter = new S3StorageAdapter();
                break;
            default:
                this.adapter = new S3StorageAdapter();
        }
    }
    static getInstance() {
        if (!StorageService.instance) {
            StorageService.instance = new StorageService();
        }
        return StorageService.instance;
    }
    getAdapter() {
        return this.adapter;
    }
    /**
     * Helper to generate a standardized key for receipts
     * format: receipts/{restaurant_id}/{year}/{month}/{uuid}_{filename}
     */
    generateReceiptKey(restaurantId, filename) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const uuid = Math.random().toString(36).substring(2, 15);
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        return `receipts/${restaurantId}/${year}/${month}/${uuid}_${sanitizedFilename}`;
    }
}
exports.StorageService = StorageService;
//# sourceMappingURL=StorageService.js.map