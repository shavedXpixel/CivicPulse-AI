export interface SignedUploadUrlResult {
  uploadUrl: string;
  storagePath: string;
  expiresAt: string;
}

export interface StorageUploadOptions {
  signalId?: string;
  mediaId?: string;
  problemId?: string;
  evidenceId?: string;
  customPath?: string;
}

export interface IStorageProvider {
  /**
   * Generates a signed or endpoint URL for uploading media directly.
   * Supports deterministic idempotent storage keys when options are provided.
   */
  getSignedUploadUrl(
    fileName: string,
    mimeType: string,
    maxSizeBytes?: number,
    options?: StorageUploadOptions
  ): Promise<SignedUploadUrlResult>;

  /**
   * Resolves the publicly accessible or authenticated read URL for a stored item.
   */
  getFileUrl(storagePath: string): Promise<string>;

  /**
   * Optional helper for saving file buffer in local disk / mock mode.
   */
  saveLocalFile?(storagePath: string, buffer: Buffer, mimeType: string): Promise<string>;

  /**
   * Universal file operations supported by both local and cloud storage providers.
   */
  saveFile?(storagePath: string, buffer: Buffer, mimeType: string): Promise<string>;
  getFile?(storagePath: string): Promise<{ buffer: Buffer; mimeType: string } | null>;
  objectExists?(storagePath: string): Promise<boolean>;
  deleteFile?(storagePath: string): Promise<void>;
}
