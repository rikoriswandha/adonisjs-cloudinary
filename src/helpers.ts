/*
|--------------------------------------------------------------------------
| Standalone Helpers
|--------------------------------------------------------------------------
|
| Thin convenience wrappers for when dependency injection is unnecessary.
|
*/

import type { TransformationOptions } from 'cloudinary'
import { defineConfig } from './cloudinary_config.js'
import { CloudinaryService } from './cloudinary_service.js'
import type { CloudinaryConfig } from './types.js'

/**
 * Create a Cloudinary service instance directly from a camelCase config.
 */
export function createCloudinaryService(config: CloudinaryConfig): CloudinaryService {
  return new CloudinaryService(defineConfig(config))
}

/**
 * Generate a transformed Cloudinary URL without instantiating a service.
 */
export function transformUrl(
  publicId: string,
  config: CloudinaryConfig,
  transformations?: TransformationOptions
): string {
  return createCloudinaryService(config).transformUrl(publicId, transformations)
}
