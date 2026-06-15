/*
|--------------------------------------------------------------------------
| Configure hook
|--------------------------------------------------------------------------
|
| The configure hook is called when someone runs "node ace configure <package>"
| command. You are free to perform any operations inside this function to
| configure the package.
|
| To make things easier, you have access to the underlying "Configure"
| instance and you can use codemods to modify the source files.
|
*/

import { fileURLToPath } from 'node:url'
import type Configure from '@adonisjs/core/commands/configure'

/**
 * Resolve stubs relative to this compiled file. Works both from source
 * (via ts-exec) and from the published `build/` directory, instead of
 * relying on `command.stubsRoot` which the Configure command populates
 * from the package export and which does not point at the stubs folder.
 */
const stubsRoot = fileURLToPath(new URL('./stubs/', import.meta.url))

export async function configure(command: Configure) {
  const codemods = await command.createCodemods()

  await codemods.makeUsingStub(stubsRoot, 'config/cloudinary.stub', {})

  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('@rikology/adonisjs-cloudinary/cloudinary_provider')
    rcFile.addCommand('@rikology/adonisjs-cloudinary/commands')
  })

  await codemods.defineEnvValidations({
    variables: {
      CLOUDINARY_CLOUD_NAME: 'Env.schema.string()',
      CLOUDINARY_API_KEY: 'Env.schema.string()',
      CLOUDINARY_API_SECRET: 'Env.schema.string()',
    },
    leadingComment: 'Variables for @rikology/adonisjs-cloudinary',
  })

  command.logger.success(
    '@rikology/adonisjs-cloudinary configured. Add your CLOUDINARY_* keys to .env and verify with `node ace cloudinary:ping`.'
  )
}
