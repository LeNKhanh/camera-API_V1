import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrlBase: string;
  private storageMode: 'local' | 'r2';

  constructor() {
    // Đọc config từ environment variables
    this.bucketName = process.env.R2_BUCKET_NAME || 'iotek';
    this.publicUrlBase = process.env.R2_PUBLIC_URL || '';
    this.storageMode = (process.env.STORAGE_MODE as 'local' | 'r2') || 'r2';

    // Khởi tạo S3Client với Cloudflare R2 endpoint
    this.s3Client = new S3Client({
      region: 'auto', // R2 uses 'auto' for region
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });

    this.logger.log(
      `StorageService initialized - Mode: ${this.storageMode}, Bucket: ${this.bucketName}`,
    );
  }

  /**
   * Upload file từ local path lên R2
   * @param localPath Đường dẫn file local
   * @param key Key trong R2 bucket (ví dụ: snapshots/cam1/123.jpg)
   * @returns R2 URL hoặc local path nếu upload fail
   */
  async uploadFile(localPath: string, key: string): Promise<string> {
    // Nếu mode là local, không upload
    if (this.storageMode === 'local') {
      this.logger.debug(`Storage mode is local, skipping upload for ${key}`);
      return localPath;
    }

    try {
      this.logger.debug(`Uploading ${localPath} to R2 key: ${key}`);

      // Tạo read stream từ file local
      const fileStream = createReadStream(localPath);
      const fileBuffer = await this.streamToBuffer(fileStream);

      // Upload lên R2
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: this.getContentType(key),
      });

      await this.s3Client.send(command);

      // Tạo public URL
      const r2Url = this.buildPublicUrl(key);
      this.logger.log(`Successfully uploaded to R2: ${r2Url}`);

      return r2Url;
    } catch (error) {
      this.logger.error(`Failed to upload ${key} to R2:`, error);

      // Fallback: trả về local path
      this.logger.warn(`Falling back to local storage for ${key}`);
      return localPath;
    }
  }

  /**
   * Download file từ R2 về dạng stream
   * @param key Key của file trong R2 bucket
   * @returns Readable stream
   */
  async downloadFile(key: string): Promise<Readable> {
    try {
      this.logger.debug(`Downloading from R2 key: ${key}`);

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error(`No body in R2 response for key: ${key}`);
      }

      return response.Body as Readable;
    } catch (error) {
      this.logger.error(`Failed to download ${key} from R2:`, error);
      throw error;
    }
  }

  /**
   * Xóa file trên R2
   * @param key Key của file cần xóa
   */
  async deleteFile(key: string): Promise<void> {
    if (this.storageMode === 'local') {
      return;
    }

    try {
      this.logger.debug(`Deleting from R2 key: ${key}`);

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`Successfully deleted from R2: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete ${key} from R2:`, error);
      throw error;
    }
  }

  /**
   * Kiểm tra xem path có phải là R2 URL không
   */
  isR2Url(path: string): boolean {
    if (!path) return false;
    // Check if URL starts with public URL base or R2 endpoint
    if (this.publicUrlBase && path.startsWith(this.publicUrlBase)) {
      return true;
    }
    const endpoint = process.env.R2_ENDPOINT || '';
    if (endpoint && path.startsWith(endpoint)) {
      return true;
    }
    // Check for common R2.dev subdomain pattern or any HTTPS URL
    return path.startsWith('http://') || path.startsWith('https://');
  }

  /**
   * Extract R2 key từ URL
   * @param url R2 public URL
   * @returns R2 key hoặc null nếu không phải R2 URL
   * Example: https://iotek.tn-cdn.net/recordings/cam-id/123.mp4 -> recordings/cam-id/123.mp4
   */
  extractR2Key(url: string): string | null {
    if (!this.isR2Url(url)) {
      return null;
    }

    try {
      const urlObj = new URL(url);
      // Remove leading slash
      let pathname = urlObj.pathname.substring(1);
      
      // If URL contains bucket name, remove it
      if (pathname.startsWith(`${this.bucketName}/`)) {
        pathname = pathname.substring(this.bucketName.length + 1);
      }
      
      return pathname;
    } catch {
      return null;
    }
  }

  /**
   * Build public URL từ R2 key
   */
  private buildPublicUrl(key: string): string {
    if (this.publicUrlBase) {
      return `${this.publicUrlBase}/${key}`;
    }

    // Fallback: use endpoint with bucket
    const endpoint = process.env.R2_ENDPOINT || '';
    return `${endpoint}/${this.bucketName}/${key}`;
  }

  /**
   * Xác định Content-Type từ file extension
   */
  private getContentType(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      mp4: 'video/mp4',
      webm: 'video/webm',
      avi: 'video/x-msvideo',
    };

    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  /**
   * Convert stream to buffer
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
