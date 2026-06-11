/*
|--------------------------------------------------------------------------
| Cloudinary Service
|--------------------------------------------------------------------------
|
| Injectable service class that wraps the Cloudinary v2 SDK.
| Fleshed out fully in Phase 3.
|
*/

import { v2 as cloudinary } from 'cloudinary'
import type {
  UploadApiOptions,
  UploadApiResponse,
  UploadStream,
  TransformationOptions,
} from 'cloudinary'
import type { ConfigOptions } from './types.js'

/**
 * Injectable service class that wraps the Cloudinary v2 SDK.
 */
export class CloudinaryService {
  constructor(config: ConfigOptions) {
    cloudinary.config(config)
  }

  /**
   * Access the raw Cloudinary v2 SDK for power users.
   */
  get sdk() {
    return cloudinary
  }

  /**
   * Upload an image to Cloudinary.
   */
  uploadImage(file: string, options?: UploadApiOptions): Promise<UploadApiResponse> {
    return cloudinary.uploader.upload(file, {
      resource_type: 'image',
      ...options,
    })
  }

  /**
   * Upload a video to Cloudinary.
   */
  uploadVideo(file: string, options?: UploadApiOptions): Promise<UploadApiResponse> {
    return cloudinary.uploader.upload(file, {
      resource_type: 'video',
      ...options,
    })
  }

  /**
   * Upload a raw file to Cloudinary.
   */
  uploadFile(file: string, options?: UploadApiOptions): Promise<UploadApiResponse> {
    return cloudinary.uploader.upload(file, {
      resource_type: 'raw',
      ...options,
    })
  }

  /**
   * Generate a transformed delivery URL for a public_id.
   */
  transformUrl(publicId: string, transformations?: TransformationOptions): string {
    return cloudinary.url(publicId, transformations)
  }

  /**
   * Generate a signed URL (optionally with an expiration time).
   */
  signedUrl(
    publicId: string,
    options?: {
      expiresAt?: Date | number
    } & Record<string, any>
  ): string {
    const urlOptions: Record<string, any> = {
      sign_url: true,
      ...options,
    }

    if (options?.expiresAt) {
      urlOptions.expires_at =
        typeof options.expiresAt === 'number'
          ? options.expiresAt
          : Math.floor(options.expiresAt.getTime() / 1000)
      delete urlOptions.expiresAt
    }

    return cloudinary.url(publicId, urlOptions)
  }

  /**
   * Get an upload stream for streaming uploads.
   */
  uploadStream(options?: UploadApiOptions): UploadStream {
    return cloudinary.uploader.upload_stream(options)
  }

  /**
   * Destroy an asset by public_id.
   */
  destroy(publicId: string, options?: UploadApiOptions): Promise<any> {
    return cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      ...options,
    })
  }
}
