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

import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
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

  /**
   * Prompt for Cloudinary credentials.
   * Get yours from https://cloudinary.com/console
   */
  const cloudName = await command.prompt.ask('Enter your Cloudinary cloud name', {
    validate: (value: string) => (value ? true : 'Cloud name is required'),
  })

  const apiKey = await command.prompt.secure('Enter your Cloudinary API key', {
    validate: (value: string) => (value ? true : 'API key is required'),
  })

  const apiSecret = await command.prompt.secure('Enter your Cloudinary API secret', {
    validate: (value: string) => (value ? true : 'API secret is required'),
  })

  /**
   * Publish config/cloudinary.ts, prompting before overwriting an existing file.
   */
  const configPath = command.app.configPath('cloudinary.ts')
  const configExists = await access(configPath, constants.F_OK)
    .then(() => true)
    .catch(() => false)

  if (configExists) {
    const overwrite = await command.prompt.confirm(
      'A config/cloudinary.ts file already exists. Do you want to overwrite it?'
    )

    if (!overwrite) {
      command.logger.info('Skipped publishing config/cloudinary.ts')
    } else {
      await codemods.makeUsingStub(stubsRoot, 'config/cloudinary.stub', {})
      command.logger.success('Updated config/cloudinary.ts')
    }
  } else {
    await codemods.makeUsingStub(stubsRoot, 'config/cloudinary.stub', {})
    command.logger.success('Created config/cloudinary.ts')
  }

  /**
   * Write env variables. API key/secret are omitted from the example file.
   */
  await codemods.defineEnvVariables(
    {
      CLOUDINARY_CLOUD_NAME: cloudName,
      CLOUDINARY_API_KEY: apiKey,
      CLOUDINARY_API_SECRET: apiSecret,
    },
    {
      omitFromExample: ['CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
    }
  )

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
    '@rikology/adonisjs-cloudinary configured. Verify your setup with `node ace cloudinary:ping`.'
  )
}
