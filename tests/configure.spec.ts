import { test } from '@japa/runner'
import { configure } from '../configure.js'

test.group('Configure hook', () => {
  test('publishes config stub and registers provider', async ({ assert }) => {
    const calls: any[] = []

    const fakeCodemods = {
      makeUsingStub: async (...args: any[]) => {
        calls.push({ method: 'makeUsingStub', args })
      },
      updateRcFile: async (cb: any) => {
        calls.push({ method: 'updateRcFile', cb })
      },
    }

    const fakeCommand = {
      stubsRoot: '/fake/stubs',
      createCodemods: async () => fakeCodemods,
    }

    await configure(fakeCommand as any)

    assert.equal(calls.length, 2)
    assert.equal(calls[0].method, 'makeUsingStub')
    assert.deepEqual(calls[0].args, ['/fake/stubs', 'config/cloudinary.stub', {}])

    assert.equal(calls[1].method, 'updateRcFile')

    const fakeRcFile = {
      addProvider: (provider: string) => {
        calls.push({ method: 'addProvider', provider })
      },
    }

    await calls[1].cb(fakeRcFile)

    assert.deepEqual(calls[2], {
      method: 'addProvider',
      provider: '@rikology/adonisjs-cloudinary/cloudinary_provider',
    })
  })
})
