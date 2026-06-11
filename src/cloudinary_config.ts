/*
|--------------------------------------------------------------------------
| Cloudinary Config
|--------------------------------------------------------------------------
|
| Define the user-facing configuration helper that validates input
| and maps camelCase fields to the snake_case format expected by
| the Cloudinary v2 SDK.
|
*/

import type { CloudinaryConfig, ConfigOptions } from './types.js'

/**
 * Validate required fields and convert camelCase config to the
 * snake_case shape expected by the Cloudinary SDK.
 */
export function defineConfig(config: CloudinaryConfig): ConfigOptions {
  if (!config.cloudName) {
    throw new Error('Cloudinary config is missing required field: cloudName')
  }

  if (!config.apiKey) {
    throw new Error('Cloudinary config is missing required field: apiKey')
  }

  if (!config.apiSecret) {
    throw new Error('Cloudinary config is missing required field: apiSecret')
  }

  return {
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: config.secure ?? true,
  }
}
