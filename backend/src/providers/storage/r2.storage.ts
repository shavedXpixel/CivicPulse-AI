import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageProvider, SignedUploadUrlResult, StorageUploadOptions } from './storage.interface';
import { MAX_MEDIA_FILE_SIZE_BYTES } from '@civicpulse/shared';
import { env } from '../../config/env';

export interface R2StorageConfig {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
}

export class R2StorageProvider implements IStorageProvider {
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private accountId: string;

  constructor(config?: R2StorageConfig) {
    this.accountId = config?.accountId || env.R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || '';
    const accessKeyId = config?.accessKeyId || env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '';
    const secretAccessKey = config?.secretAccessKey || env.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '';
    this.bucketName = config?.bucketName || env.R2_BUCKET_NAME || process.env.R2_BUCKET_NAME || 'civicpulse-media';

    if (this.accountId && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey
        }
      });
    }
  }

  public getBucketName(): string {
    return this.bucketName;
  }

  private ensureClient(): S3Client {
    if (!this.s3Client) {
      throw new Error(
        '[R2StorageProvider] Cloudflare R2 credentials are not configured. ' +
        'Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.'
      );
    }
    return this.s3Client;
  }

  async getSignedUploadUrl(
    fileName: string,
    mimeType: string,
    maxSizeBytes: number = MAX_MEDIA_FILE_SIZE_BYTES,
    options?: StorageUploadOptions
  ): Promise<SignedUploadUrlResult> {
    if (maxSizeBytes > MAX_MEDIA_FILE_SIZE_BYTES) {
      throw new Error(`Requested size exceeds canonical limit of ${MAX_MEDIA_FILE_SIZE_BYTES} bytes`);
    }

    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    let storagePath: string;

    if (options?.customPath) {
      storagePath = options.customPath;
    } else if (options?.signalId && options?.mediaId) {
      const sanitizedSignalId = options.signalId.replace(/[^a-zA-Z0-9._-]/g, '_');
      const sanitizedMediaId = options.mediaId.replace(/[^a-zA-Z0-9._-]/g, '_');
      storagePath = `signals/${sanitizedSignalId}/${sanitizedMediaId}-${sanitizedName}`;
    } else if (options?.problemId && options?.evidenceId) {
      const sanitizedProblemId = options.problemId.replace(/[^a-zA-Z0-9._-]/g, '_');
      const sanitizedEvidenceId = options.evidenceId.replace(/[^a-zA-Z0-9._-]/g, '_');
      storagePath = `evidence/${sanitizedProblemId}/${sanitizedEvidenceId}-${sanitizedName}`;
    } else {
      storagePath = `signals/${Date.now()}_${sanitizedName}`;
    }

    const expiresSeconds = 15 * 60; // 15 minutes
    const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();

    const client = this.ensureClient();
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storagePath,
      ContentType: mimeType
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresSeconds });
    return { uploadUrl, storagePath, expiresAt };
  }

  async getFileUrl(storagePath: string): Promise<string> {
    return `/api/v1/storage/files?path=${encodeURIComponent(storagePath)}`;
  }

  async objectExists(storagePath: string): Promise<boolean> {
    const client = this.ensureClient();
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: storagePath
        })
      );
      return true;
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  async saveFile(storagePath: string, buffer: Buffer, mimeType: string): Promise<string> {
    if (buffer.length > MAX_MEDIA_FILE_SIZE_BYTES) {
      throw new Error(`File size ${buffer.length} bytes exceeds 10 MB maximum allowed limit.`);
    }

    const client = this.ensureClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: storagePath,
        Body: buffer,
        ContentType: mimeType
      })
    );

    return this.getFileUrl(storagePath);
  }

  async getFile(storagePath: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const client = this.ensureClient();
    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: storagePath
        })
      );

      if (!response.Body) {
        return null;
      }

      // Convert stream to Buffer
      const stream = response.Body as any;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      return {
        buffer,
        mimeType: response.ContentType || 'image/jpeg'
      };
    } catch (err: any) {
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  async deleteFile(storagePath: string): Promise<void> {
    const client = this.ensureClient();
    await client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: storagePath
      })
    );
  }
}
