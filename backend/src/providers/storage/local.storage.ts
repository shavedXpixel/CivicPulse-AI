import { IStorageProvider, SignedUploadUrlResult, StorageUploadOptions } from './storage.interface';
import { MAX_MEDIA_FILE_SIZE_BYTES } from '@civicpulse/shared';

export class LocalStorageProvider implements IStorageProvider {
  private files = new Map<string, { buffer: Buffer; mimeType: string }>();

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
    if (this.files.has(storagePath)) {
      throw new Error(`Object already exists at storage path "${storagePath}". Overwrites are forbidden.`);
    }
    this.files.set(storagePath, { buffer, mimeType });
    return this.getFileUrl(storagePath);
  }

  async saveFile(storagePath: string, buffer: Buffer, mimeType: string): Promise<string> {
    return this.saveLocalFile(storagePath, buffer, mimeType);
  }

  async objectExists(storagePath: string): Promise<boolean> {
    return this.files.has(storagePath);
  }

  async getFile(storagePath: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    return this.files.get(storagePath) || null;
  }

  async deleteFile(storagePath: string): Promise<void> {
    this.files.delete(storagePath);
  }

  getLocalFile(storagePath: string): { buffer: Buffer; mimeType: string } | null {
    return this.files.get(storagePath) || null;
  }
}
