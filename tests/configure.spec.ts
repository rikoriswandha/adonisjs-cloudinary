import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { test } from '@japa/runner'
import { configure } from '../configure.js'

test.group('Configure hook', () => {
  test('prompts for credentials, writes env vars, publishes config, and registers provider + commands', async ({
    assert,
  }) => {
    const calls: any[] = []

    const fakeCodemods = {
      makeUsingStub: async (...args: any[]) => {
        calls.push({ method: 'makeUsingStub', args })
      },
      updateRcFile: async (cb: any) => {
        calls.push({ method: 'updateRcFile', cb })
      },
      defineEnvVariables: async (vars: any, options: any) => {
        calls.push({ method: 'defineEnvVariables', vars, options })
      },
      defineEnvValidations: async (opts: any) => {
        calls.push({ method: 'defineEnvValidations', opts })
      },
    }

    const fakeCommand = {
      app: {
        // a path that does not exist on disk -> takes the "create" branch
        configPath: (file: string) => join(tmpdir(), `cloudinary-test-${file}`),
      },
      prompt: {
        ask: async (msg: string) => {
          calls.push({ method: 'prompt.ask', msg })
          return 'demo-cloud'
        },
        secure: async (msg: string) => {
          calls.push({ method: 'prompt.secure', msg })
          return msg.toLowerCase().includes('secret') ? 'demo-secret' : 'demo-key'
        },
        confirm: async (msg: string) => {
          calls.push({ method: 'prompt.confirm', msg })
          return true
        },
      },
      createCodemods: async () => fakeCodemods,
      logger: {
        success: (msg: string) => calls.push({ method: 'logger.success', msg }),
        info: (msg: string) => calls.push({ method: 'logger.info', msg }),
      },
    }

    await configure(fakeCommand as any)

    // prompted for cloud name + the two masked secrets
    assert.isTrue(calls.some((c) => c.method === 'prompt.ask'))
    assert.equal(calls.filter((c) => c.method === 'prompt.secure').length, 2)

    // env variables written with the prompted values; key/secret omitted from the example
    const envCall = calls.find((c) => c.method === 'defineEnvVariables')!
    assert.deepEqual(envCall.vars, {
      CLOUDINARY_CLOUD_NAME: 'demo-cloud',
      CLOUDINARY_API_KEY: 'demo-key',
      CLOUDINARY_API_SECRET: 'demo-secret',
    })
    assert.deepEqual(envCall.options, {
      omitFromExample: ['CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
    })

    // stub published from the package's own stubs dir (not command.stubsRoot)
    const stubCall = calls.find((c) => c.method === 'makeUsingStub')!
    assert.isTrue(stubCall.args[0].endsWith('stubs/'), `${stubCall.args[0]} should end with stubs/`)
    assert.equal(stubCall.args[1], 'config/cloudinary.stub')

    // rc file registers provider + commands
    const rcCall = calls.find((c) => c.method === 'updateRcFile')!
    const rcActions: string[] = []
    await rcCall.cb({
      addProvider: (p: string) => rcActions.push(`provider:${p}`),
      addCommand: (c: string) => rcActions.push(`command:${c}`),
    })
    assert.deepEqual(rcActions, [
      'provider:@rikology/adonisjs-cloudinary/cloudinary_provider',
      'command:@rikology/adonisjs-cloudinary/commands',
    ])

    // env validations for the three credentials
    const envValCall = calls.find((c) => c.method === 'defineEnvValidations')!
    assert.deepEqual(envValCall.opts.variables, {
      CLOUDINARY_CLOUD_NAME: 'Env.schema.string()',
      CLOUDINARY_API_KEY: 'Env.schema.string()',
      CLOUDINARY_API_SECRET: 'Env.schema.string()',
    })

    // guidance logged
    assert.isTrue(calls.some((c) => c.method === 'logger.success'))
  })

  test('skips overwriting an existing config when the user declines', async ({ assert }) => {
    const calls: any[] = []
    const realConfigPath = join(tmpdir(), `cloudinary-existing-${Date.now()}.ts`)
    // pre-create the file so the overwrite prompt is triggered
    const { writeFile } = await import('node:fs/promises')
    await writeFile(realConfigPath, 'export default {}')

    const fakeCodemods = {
      makeUsingStub: async (...args: any[]) => {
        calls.push({ method: 'makeUsingStub', args })
      },
      updateRcFile: async () => {},
      defineEnvVariables: async () => {},
      defineEnvValidations: async () => {},
    }

    const fakeCommand = {
      app: { configPath: () => realConfigPath },
      prompt: {
        ask: async () => 'demo-cloud',
        secure: async () => 'demo-key',
        confirm: async () => false,
      },
      createCodemods: async () => fakeCodemods,
      logger: {
        success: (msg: string) => calls.push({ method: 'logger.success', msg }),
        info: (msg: string) => calls.push({ method: 'logger.info', msg }),
      },
    }

    await configure(fakeCommand as any)

    // user declined overwrite -> stub not published, info logged
    assert.isFalse(calls.some((c) => c.method === 'makeUsingStub'))
    assert.isTrue(calls.some((c) => c.method === 'logger.info'))
  })
})

test.group('Package contracts', () => {
  test('registered provider + commands subpaths are declared in package exports', async ({
    assert,
  }) => {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf-8'))
    assert.isDefined(pkg.exports['./cloudinary_provider'])
    assert.isDefined(pkg.exports['./commands'])
  })

  test('commands.json lists the ping command', async ({ assert }) => {
    const index = JSON.parse(
      await readFile(new URL('../commands/commands.json', import.meta.url), 'utf-8')
    )
    const names = index.commands.map((c: any) => c.commandName)
    assert.include(names, 'cloudinary:ping')
  })
})
