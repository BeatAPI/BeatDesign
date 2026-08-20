/**
 * Storage configuration
 */
export interface StorageConfig {
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
  forcePathStyle?: boolean;
}

/**
 * Storage provider error types
 */
export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

export class ConfigurationError extends StorageError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class UploadError extends StorageError {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

/**
 * Upload file parameters
 */
export interface UploadFileParams {
  file: Buffer | Blob;
  filename: string;
  contentType: string;
  folder?: string;
  bucketName?: string;
  publicUrl?: string;
}

/**
 * Upload file result
 */
export interface UploadFileResult {
  url: string;
  key: string;
  assetId?: string;
}

export interface PresignedUploadParams {
  filename: string;
  contentType: string;
  key: string;
  bucketName?: string;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
}

/**
 * Storage provider interface
 */
export interface StorageProvider {
  /**
   * Upload a file to storage
   */
  uploadFile(params: UploadFileParams): Promise<UploadFileResult>;

  /**
   * Create a presigned direct-upload URL.
   */
  createPresignedUpload(
    params: PresignedUploadParams
  ): Promise<PresignedUploadResult>;

  /**
   * Check whether a storage object exists.
   */
  objectExists(
    key: string,
    options?: { bucketName?: string }
  ): Promise<boolean>;

  /**
   * Delete a file from storage
   */
  deleteFile(key: string): Promise<void>;

  /**
   * Get the provider's name
   */
  getProviderName(): string;
}
