import { randomUUID } from 'crypto';
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3mini as s3mini } from 's3mini';
import {
  ConfigurationError,
  type PresignedUploadParams,
  type PresignedUploadResult,
  type StorageConfig,
  StorageError,
  type StorageProvider,
  UploadError,
  type UploadFileParams,
  type UploadFileResult,
} from '../types';

/**
 * Amazon S3 storage provider implementation using s3mini
 *
 * docs:
 * VisuGen internal docs
 *
 * This provider works with Amazon S3 and compatible services like Cloudflare R2
 * using s3mini for S3-compatible object storage
 * https://github.com/good-lly/s3mini
 * https://developers.cloudflare.com/r2/
 */
export class S3Provider implements StorageProvider {
  private config: StorageConfig;
  private s3Client: s3mini | null = null;
  private awsS3Client: S3Client | null = null;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  /**
   * Get the provider name
   */
  public getProviderName(): string {
    return 'S3';
  }

  /**
   * Get the S3 client instance
   */
  private getS3Client(): s3mini {
    if (this.s3Client) {
      return this.s3Client;
    }

    const { region, endpoint, accessKeyId, secretAccessKey, bucketName } =
      this.config;

    if (!region) {
      throw new ConfigurationError('Storage region is not configured');
    }

    if (!accessKeyId || !secretAccessKey) {
      throw new ConfigurationError('Storage credentials are not configured');
    }

    if (!endpoint) {
      throw new ConfigurationError('Storage endpoint is required for s3mini');
    }

    if (!bucketName) {
      throw new ConfigurationError('Storage bucket name is not configured');
    }

    // s3mini client configuration
    // The bucket name needs to be included in the endpoint URL for s3mini
    const endpointWithBucket = `${endpoint.replace(/\/$/, '')}/${bucketName}`;

    this.s3Client = new s3mini({
      accessKeyId,
      secretAccessKey,
      endpoint: endpointWithBucket,
      region,
    });

    return this.s3Client;
  }

  private getAwsS3Client(): S3Client {
    if (this.awsS3Client) {
      return this.awsS3Client;
    }

    const { region, endpoint, accessKeyId, secretAccessKey, forcePathStyle } =
      this.config;

    if (!region) {
      throw new ConfigurationError('Storage region is not configured');
    }

    if (!accessKeyId || !secretAccessKey) {
      throw new ConfigurationError('Storage credentials are not configured');
    }

    if (!endpoint) {
      throw new ConfigurationError('Storage endpoint is required for presign');
    }

    this.awsS3Client = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    return this.awsS3Client;
  }

  /**
   * Generate a unique filename with the original extension
   */
  private generateUniqueFilename(originalFilename: string): string {
    const extension = originalFilename.split('.').pop() || '';
    const uuid = randomUUID();
    return `${uuid}${extension ? `.${extension}` : ''}`;
  }

  /**
   * Upload a file to S3
   */
  public async uploadFile(params: UploadFileParams): Promise<UploadFileResult> {
    try {
      const { file, filename, contentType, folder, bucketName, publicUrl } =
        params;
      const targetBucketName = bucketName || this.config.bucketName;
      const targetPublicUrl = publicUrl || this.config.publicUrl;
      const targetEndpoint = this.config.endpoint || '';
      const endpointWithBucket = `${targetEndpoint.replace(/\/$/, '')}/${targetBucketName}`;
      const s3 = bucketName
        ? new s3mini({
            accessKeyId: this.config.accessKeyId,
            secretAccessKey: this.config.secretAccessKey,
            endpoint: endpointWithBucket,
            region: this.config.region,
          })
        : this.getS3Client();

      const uniqueFilename = this.generateUniqueFilename(filename);
      const key = folder ? `${folder}/${uniqueFilename}` : uniqueFilename;

      // Convert Blob to Buffer if needed
      let fileContent: Buffer | string;
      if (file instanceof Blob) {
        fileContent = Buffer.from(await file.arrayBuffer());
      } else {
        fileContent = file;
      }

      // Upload the file using s3mini
      const response = await s3.putObject(key, fileContent, contentType);

      if (!response.ok) {
        throw new UploadError(`Failed to upload file: ${response.statusText}`);
      }

      // Generate the URL
      let url: string;

      if (targetPublicUrl) {
        // Use custom domain if provided
        url = `${targetPublicUrl.replace(/\/$/, '')}/${key}`;
      } else {
        // For s3mini, we construct the URL manually
        // Since bucket is included in endpoint, we just append the key
        const baseUrl = `${targetEndpoint.replace(/\/$/, '')}/${targetBucketName}`;
        url = `${baseUrl}/${key}`;
      }

      return { url, key };
    } catch (error) {
      if (error instanceof ConfigurationError) {
        console.error('uploadFile, configuration error', error);
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error occurred during file upload';
      console.error('uploadFile, error', message);
      throw new UploadError(message);
    }
  }

  public async createPresignedUpload(
    params: PresignedUploadParams
  ): Promise<PresignedUploadResult> {
    const targetBucketName = params.bucketName || this.config.bucketName;

    if (!targetBucketName) {
      throw new ConfigurationError('Storage bucket name is not configured');
    }

    const client = this.getAwsS3Client();
    const command = new PutObjectCommand({
      Bucket: targetBucketName,
      Key: params.key,
      ContentType: params.contentType,
    });
    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: 60 * 5,
    });

    return {
      uploadUrl,
      method: 'PUT',
      headers: {
        'content-type': params.contentType,
      },
    };
  }

  public async objectExists(
    key: string,
    options?: { bucketName?: string }
  ): Promise<boolean> {
    const targetBucketName = options?.bucketName || this.config.bucketName;
    if (!targetBucketName) {
      throw new ConfigurationError('Storage bucket name is not configured');
    }

    const client = this.getAwsS3Client();
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: targetBucketName,
          Key: key,
        })
      );
      return true;
    } catch (error) {
      const statusCode =
        typeof error === 'object' &&
        error !== null &&
        '$metadata' in error &&
        typeof (error as { $metadata?: { httpStatusCode?: unknown } }).$metadata
          ?.httpStatusCode === 'number'
          ? (error as { $metadata: { httpStatusCode: number } }).$metadata
              .httpStatusCode
          : null;
      if (statusCode === 403 || statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Delete a file from S3
   */
  public async deleteFile(key: string): Promise<void> {
    try {
      const s3 = this.getS3Client();

      const wasDeleted = await s3.deleteObject(key);

      if (!wasDeleted) {
        console.warn(
          `File with key ${key} was not found or could not be deleted`
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error occurred during file deletion';
      console.error('deleteFile, error', message);
      throw new StorageError(message);
    }
  }
}
