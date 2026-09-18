import { getStorage } from 'firebase-admin/storage';
import { getFirebaseAdminApp } from '../../infrastructure/firebase/firebase-admin';
import { IStorageProvider, SignedUploadUrlResult, StorageUploadOptions } from './storage.interface';
import { MAX_MEDIA_FILE_SIZE_BYTES } from '@civicpulse/shared';

export class GCSStorageProvider implements IStorageProvider {
  private bucketName: string;

  constructor(bucketName?: string) {
    this.bucketName =
      bucketName ||
      process.env.STORAGE_BUCKET ||
      process.env.GCS_MEDIA_BUCKET ||
      'civicpulse-ai-f1bbf.firebasestorage.app';
  }

  public getBucketName(): string {
    return this.bucketName;
  }

  private getBucket() {
    const app = getFirebaseAdminApp();
    return getStorage(app).bucket(this.bucketName);
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

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const file = this.getBucket().file(storagePath);
    try {
      const [uploadUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType: mimeType
      });
      return { uploadUrl, storagePath, expiresAt };
    } catch {
      // Direct storage URL fallback
      const uploadUrl = `https://storage.googleapis.com/${this.bucketName}/${storagePath}`;
      return { uploadUrl, storagePath, expiresAt };
    }
  }

  async getFileUrl(storagePath: string): Promise<string> {
    return `/api/v1/storage/files?path=${encodeURIComponent(storagePath)}`;
  }

  async objectExists(storagePath: string): Promise<boolean> {
    const file = this.getBucket().file(storagePath);
    const [exists] = await file.exists();
    return exists;
  }

  async saveFile(storagePath: string, buffer: Buffer, mimeType: string): Promise<string> {
    if (buffer.length > MAX_MEDIA_FILE_SIZE_BYTES) {
      throw new Error(`File size ${buffer.length} bytes exceeds 10 MB maximum allowed limit.`);
    }
    const file = this.getBucket().file(storagePath);
    await file.save(buffer, {
      contentType: mimeType,
      resumable: false,
      validation: false
    });
    return this.getFileUrl(storagePath);
  }

  async getFile(storagePath: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const file = this.getBucket().file(storagePath);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    return {
      buffer,
      mimeType: (metadata.contentType as string) || 'image/jpeg'
    };
  }

  async deleteFile(storagePath: string): Promise<void> {
    const file = this.getBucket().file(storagePath);
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
    }
  }
}
