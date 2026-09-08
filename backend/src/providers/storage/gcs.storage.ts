import { IStorageProvider, SignedUploadUrlResult } from './storage.interface';
import { MAX_MEDIA_FILE_SIZE_BYTES } from '@civicpulse/shared';

export class GCSStorageProvider implements IStorageProvider {
  private bucketName: string;

  constructor(bucketName: string = process.env.GCS_MEDIA_BUCKET || 'civicpulse-media') {
    this.bucketName = bucketName;
  }

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
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // In a live GCP deployment, use @google-cloud/storage bucket.file(storagePath).getSignedUrl(...)
    const uploadUrl = `https://storage.googleapis.com/${this.bucketName}/${storagePath}`;

    return {
      uploadUrl,
      storagePath,
      expiresAt
    };
  }

  async getFileUrl(storagePath: string): Promise<string> {
    return `https://storage.googleapis.com/${this.bucketName}/${storagePath}`;
  }
}
