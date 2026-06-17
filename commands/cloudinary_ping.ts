/*
|--------------------------------------------------------------------------
| cloudinary:ping
|--------------------------------------------------------------------------
|
| Verifies that the configured Cloudinary credentials are valid and the
| API is reachable. Run it right after `node ace add` to confirm the
| install before touching real media.
|
*/

import { BaseCommand } from '@adonisjs/core/ace'
import { CloudinaryService } from '../src/cloudinary_service.js'

export default class CloudinaryPing extends BaseCommand {
  static commandName = 'cloudinary:ping'
  static description = 'Verify Cloudinary credentials and API connectivity'
  static options = { startApp: true as const }

  async run() {
    const cloudinary = await this.app.container.make(CloudinaryService)

    try {
      const result = await cloudinary.sdk.api.ping()
      const status = (result as { status?: string }).status ?? 'ok'
      this.logger.success(`Cloudinary API reachable (status: ${status}).`)
      this.exitCode = 0
    } catch (error) {
      this.logger.error(`Cloudinary ping failed: ${(error as Error).message}`)
      this.exitCode = 1
    }
  }
}
