/*
|--------------------------------------------------------------------------
| Cloudinary Drive Bridge
|--------------------------------------------------------------------------
|
| Opt-in FlyDrive driver that wraps CloudinaryService. Cloudinary is
| not a traditional file system, so byte-level reads are unsupported.
|
*/

import type { Readable } from 'node:stream'
import type {
  DriverContract,
  ObjectMetaData,
  ObjectVisibility,
  SignedURLOptions,
  WriteOptions,
} from 'flydrive/types'
import { DriveFile } from 'flydrive'
import { type CloudinaryService } from '../cloudinary_service.js'

export class CloudinaryDrive implements DriverContract {
  constructor(protected cloudinary: CloudinaryService) {}

  /**
   * Check if an asset exists by searching the Cloudinary API.
   * Rate-limited — avoid using in hot paths.
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.cloudinary.sdk.api.resources({
      type: 'upload',
      prefix: key,
      max_results: 1,
    })
    return result.resources.length > 0
  }

  /**
   * Cloudinary does not support raw content retrieval.
   */
  async get(_key: string): Promise<string> {
    throw new Error('Cloudinary does not support raw content retrieval. Use getUrl() instead.')
  }

  /**
   * Cloudinary does not support raw content retrieval.
   */
  async getStream(_key: string): Promise<Readable> {
    throw new Error('Cloudinary does not support raw content retrieval. Use getUrl() instead.')
  }

  /**
   * Cloudinary does not support raw content retrieval.
   */
  async getBytes(_key: string): Promise<Uint8Array> {
    throw new Error('Cloudinary does not support raw content retrieval. Use getUrl() instead.')
  }

  /**
   * Return metadata for an asset by public_id.
   */
  async getMetaData(key: string): Promise<ObjectMetaData> {
    const result = await this.cloudinary.sdk.api.resources({
      type: 'upload',
      prefix: key,
      max_results: 1,
    })

    const resource = result.resources[0]
    if (!resource) {
      throw new Error(`E_CANNOT_READ_FILE: Asset "${key}" does not exist`)
    }

    return {
      contentType: resource.resource_type,
      contentLength: resource.bytes,
      lastModified: new Date(resource.created_at),
      etag: String(resource.version ?? ''),
    }
  }

  /**
   * Cloudinary assets are public by default.
   */
  async getVisibility(_key: string): Promise<ObjectVisibility> {
    return 'public'
  }

  /**
   * Generate a delivery URL for the asset.
   */
  async getUrl(key: string): Promise<string> {
    return this.cloudinary.transformUrl(key)
  }

  /**
   * Generate a signed URL (optionally with expiration).
   */
  async getSignedUrl(key: string, options?: SignedURLOptions): Promise<string> {
    return this.cloudinary.signedUrl(key, {
      expiresAt: options?.expiresIn
        ? Math.floor(Date.now() / 1000) + Number(options.expiresIn)
        : undefined,
    })
  }

  /**
   * Cloudinary does not support signed upload URLs via the standard
   * FlyDrive pattern. Use upload presets or direct SDK calls instead.
   */
  async getSignedUploadUrl(_key: string, _options?: SignedURLOptions): Promise<string> {
    throw new Error(
      'Cloudinary does not support getSignedUploadUrl. Use upload presets or direct SDK calls instead.'
    )
  }

  /**
   * Cloudinary visibility is managed via access control, not per-file.
   */
  async setVisibility(_key: string, _visibility: ObjectVisibility): Promise<void> {
    // NOOP
  }

  /**
   * Upload contents as a base64 data URI.
   */
  async put(key: string, contents: string | Uint8Array, options?: WriteOptions): Promise<void> {
    const buffer = typeof contents === 'string' ? Buffer.from(contents) : Buffer.from(contents)
    const contentType = options?.contentType ?? 'text/plain'
    const base64 = buffer.toString('base64')

    await this.cloudinary.sdk.uploader.upload(`data:${contentType};base64,${base64}`, {
      public_id: key,
    })
  }

  /**
   * Upload contents via a stream.
   */
  async putStream(key: string, contents: Readable, options?: WriteOptions): Promise<void> {
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    const stream = this.cloudinary.uploadStream({ public_id: key, ...options })

    contents.pipe(stream).on('finish', resolve).on('error', reject)

    return promise
  }

  /**
   * Cloudinary does not support server-side copy.
   */
  async copy(_source: string, _destination: string, _options?: WriteOptions): Promise<void> {
    throw new Error('Cloudinary does not support server-side copy.')
  }

  /**
   * Rename an asset from source to destination public_id.
   */
  async move(source: string, destination: string, _options?: WriteOptions): Promise<void> {
    await this.cloudinary.sdk.uploader.rename(source, destination)
  }

  /**
   * Destroy an asset by public_id.
   */
  async delete(key: string): Promise<void> {
    await this.cloudinary.destroy(key)
  }

  /**
   * Delete all assets matching a prefix.
   */
  async deleteAll(prefix: string): Promise<void> {
    const result = await this.cloudinary.sdk.api.resources({
      type: 'upload',
      prefix,
      max_results: 500,
    })

    for (const resource of result.resources) {
      await this.cloudinary.destroy(resource.public_id)
    }
  }

  /**
   * List assets matching a prefix.
   */
  async listAll(
    prefix: string,
    _options?: { recursive?: boolean; paginationToken?: string }
  ): Promise<{
    paginationToken?: string
    objects: Iterable<DriveFile>
  }> {
    const result = await this.cloudinary.sdk.api.resources({
      type: 'upload',
      prefix,
      max_results: 500,
    })

    return {
      paginationToken: undefined,
      objects: result.resources.map((r: { public_id: string }) => new DriveFile(r.public_id, this)),
    }
  }

  /**
   * Cloudinary does not support runtime bucket switching.
   */
  bucket(_bucket: string): DriverContract {
    return this
  }
}
