import { IStorageProvider, SignedUploadUrlResult } from './storage.interface';
import { MAX_MEDIA_FILE_SIZE_BYTES } from '@civicpulse/shared';

export class LocalStorageProvider implements IStorageProvider {
  private files = new Map<string, { buffer: Buffer; mimeType: string }>();

  async getSignedUploadUrl(
    fileName: string,
    mimeType: string,
    maxSizeBytes: number = MAX_MEDIA_FILE_SIZE_BYTES
  ): Promise<SignedUploadUrlResult> {
    if (maxSizeBytes > MAX_MEDIA_FILE_SIZE_BYTES) {
      throw new Error(`Requested size exceeds canonical limit of ${MAX_MEDIA_FILE_SIZE_BYTES} bytes`);
    }

    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `signals/${Date.now()}_${sanitizedName}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min expiry

    // Local upload endpoint served by backend Express app
    const uploadUrl = `/api/v1/storage/upload?path=${encodeURIComponent(storagePath)}&mime=${encodeURIComponent(mimeType)}`;

    return {
      uploadUrl,
      storagePath,
      expiresAt
    };
  }

  async getFileUrl(storagePath: string): Promise<string> {
    return `/api/v1/storage/files?path=${encodeURIComponent(storagePath)}`;
  }

  async saveLocalFile(storagePath: string, buffer: Buffer, mimeType: string): Promise<string> {
    if (buffer.length > MAX_MEDIA_FILE_SIZE_BYTES) {
      throw new Error(`File size ${buffer.length} bytes exceeds 10 MB maximum allowed limit.`);
    }
    this.files.set(storagePath, { buffer, mimeType });
    return this.getFileUrl(storagePath);
  }

  getLocalFile(storagePath: string): { buffer: Buffer; mimeType: string } | null {
    return this.files.get(storagePath) || null;
  }
}
