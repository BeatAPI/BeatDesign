import { storageConfig } from './config/storage-config';
import { S3Provider } from './provider/s3';
import type {
  PresignedUploadResult,
  StorageConfig,
  StorageProvider,
  UploadFileResult,
} from './types';

/**
 * Default storage configuration
 */
export const defaultStorageConfig: StorageConfig = storageConfig;

/**
 * Global storage provider instance
 */
let storageProvider: StorageProvider | null = null;

/**
 * Get the storage provider
 * @returns current storage provider instance
 * @throws Error if provider is not initialized
 */
export const getStorageProvider = (): StorageProvider => {
  if (!storageProvider) {
    return initializeStorageProvider();
  }
  return storageProvider;
};

/**
 * Initialize the storage provider
 * @returns initialized storage provider
 */
export const initializeStorageProvider = (): StorageProvider => {
  if (!storageProvider) {
    storageProvider = new S3Provider();
  }
  return storageProvider!;
};

/**
 * Uploads a file to the configured storage provider
 *
 * @param file - The file to upload (Buffer or Blob)
 * @param filename - Original filename with extension
 * @param contentType - MIME type of the file
 * @param folder - Optional folder path to store the file in
 * @returns Promise with the URL of the uploaded file and its storage key
 */
export const uploadFile = async (
  file: Buffer | Blob,
  filename: string,
  contentType: string,
  folder?: string,
  options?: {
    bucketName?: string;
    publicUrl?: string;
  }
): Promise<UploadFileResult> => {
  const provider = getStorageProvider();
  return provider.uploadFile({
    file,
    filename,
    contentType,
    folder,
    bucketName: options?.bucketName,
    publicUrl: options?.publicUrl,
  });
};

export const createPresignedUpload = async (
  filename: string,
  contentType: string,
  key: string,
  options?: {
    bucketName?: string;
  }
): Promise<PresignedUploadResult> => {
  const provider = getStorageProvider();
  return provider.createPresignedUpload({
    filename,
    contentType,
    key,
    bucketName: options?.bucketName,
  });
};

export const objectExists = async (
  key: string,
  options?: {
    bucketName?: string;
  }
): Promise<boolean> => {
  const provider = getStorageProvider();
  return provider.objectExists(key, {
    bucketName: options?.bucketName,
  });
};

/**
 * Deletes a file from the storage provider
 *
 * @param key - The storage key of the file to delete
 * @returns Promise that resolves when the file is deleted
 */
export const deleteFile = async (key: string): Promise<void> => {
  const provider = getStorageProvider();
  return provider.deleteFile(key);
};
