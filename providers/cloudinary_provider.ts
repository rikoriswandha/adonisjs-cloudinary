/*
|--------------------------------------------------------------------------
| Cloudinary Provider
|--------------------------------------------------------------------------
|
| Registers the Cloudinary service as a singleton in the IoC container
| and optionally registers an Edge global helper for URL generation.
|
*/

import type { ApplicationService } from '@adonisjs/core/types'
import type { ConfigOptions } from '../src/types.js'
import { CloudinaryService } from '../src/cloudinary_service.js'

// Side-effect: merges CloudinaryService into ContainerBindings
import '../src/types.js'

export default class CloudinaryProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Register the Cloudinary service as a singleton in the container.
   */
  register() {
    this.app.container.singleton('cloudinary', async () => {
      const config = this.app.config.get<ConfigOptions>('cloudinary')
      return new CloudinaryService(config)
    })
  }

  /**
   * Register Edge global helper when edge.js is available.
   */
  async boot() {
    try {
      // edge.js may not be installed in API-only apps;
      // dynamic import is intentional here.
      const { default: edge } = await import('edge.js')
      const cloudinary = await this.app.container.make('cloudinary')

      edge.global('cloudinaryUrl', (publicId: string, transformations?: any) => {
        return cloudinary.transformUrl(publicId, transformations)
      })
    } catch {
      // edge.js not installed — skip global registration
    }
  }
}
