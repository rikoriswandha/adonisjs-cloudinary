/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
|
| Export type contracts and augment the AdonisJS container bindings
| so TypeScript knows how to resolve the Cloudinary service.
|
*/

import type { CloudinaryService } from './cloudinary_service.js'

/**
 * User-facing camelCase configuration for the Cloudinary provider.
 */
export interface CloudinaryConfig {
  /**
   * Cloudinary cloud name (e.g. "my-app").
   */
  cloudName: string

  /**
   * Cloudinary API key.
   */
  apiKey: string

  /**
   * Cloudinary API secret.
   */
  apiSecret: string

  /**
   * Whether to use HTTPS URLs. Defaults to `true`.
   */
  secure?: boolean
}

/**
 * snake_case options ready to be passed to the Cloudinary v2 SDK.
 */
export interface ConfigOptions {
  cloud_name: string
  api_key: string
  api_secret: string
  secure?: boolean
}

declare module '@adonisjs/core/types' {
  export interface ContainerBindings {
    cloudinary: CloudinaryService
  }
}
