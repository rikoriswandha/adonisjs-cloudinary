import { readFile } from 'node:fs/promises'

import { test } from '@japa/runner'
import { configure } from '../configure.js'

test.group('Configure hook', () => {
  test('publishes config stub, registers provider + commands, and defines env vars', async ({
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
      defineEnvValidations: async (opts: any) => {
        calls.push({ method: 'defineEnvValidations', opts })
      },
    }

    const fakeCommand = {
      createCodemods: async () => fakeCodemods,
      logger: {
        success: (msg: string) => {
          calls.push({ method: 'logger.success', msg })
        },
      },
    }

    await configure(fakeCommand as any)

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
    const envCall = calls.find((c) => c.method === 'defineEnvValidations')!
    assert.deepEqual(envCall.opts.variables, {
      CLOUDINARY_CLOUD_NAME: 'Env.schema.string()',
      CLOUDINARY_API_KEY: 'Env.schema.string()',
      CLOUDINARY_API_SECRET: 'Env.schema.string()',
    })

    // guidance logged
    assert.isTrue(calls.some((c) => c.method === 'logger.success'))
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
