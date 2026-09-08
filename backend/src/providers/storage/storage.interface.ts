export interface SignedUploadUrlResult {
  uploadUrl: string;
  storagePath: string;
  expiresAt: string;
}

export interface IStorageProvider {
  /**
   * Generates a signed or endpoint URL for uploading media directly.
   */
  getSignedUploadUrl(
    fileName: string,
    mimeType: string,
    maxSizeBytes?: number
  ): Promise<SignedUploadUrlResult>;

  /**
   * Resolves the publicly accessible or authenticated read URL for a stored item.
   */
  getFileUrl(storagePath: string): Promise<string>;

  /**
   * Optional helper for saving file buffer in local disk / mock mode.
   */
  saveLocalFile?(storagePath: string, buffer: Buffer, mimeType: string): Promise<string>;
}
