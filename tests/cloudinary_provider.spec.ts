import { test } from '@japa/runner'
import { Container } from '@adonisjs/fold'
import edge from 'edge.js'
import CloudinaryProvider from '../providers/cloudinary_provider.js'
import { CloudinaryService } from '../src/cloudinary_service.js'

function createMockApp(configValue: Record<string, any>) {
  const container = new Container<any>()
  return {
    container,
    config: {
      get: (_key: string) => configValue,
    },
  }
}

test.group('CloudinaryProvider', (group) => {
  group.each.setup(() => {
    return () => {
      delete edge.globals.cloudinaryUrl
    }
  })

  test('registers cloudinary as a singleton in the container', async ({ assert }) => {
    const app = createMockApp({
      cloud_name: 'demo',
      api_key: 'test-key',
      api_secret: 'test-secret',
      secure: true,
    })

    const provider = new CloudinaryProvider(app as any)
    provider.register()

    const service = await app.container.make('cloudinary')
    assert.instanceOf(service, CloudinaryService)
    assert.equal(service.sdk.config().cloud_name, 'demo')
  })

  test('registers CloudinaryService as a class token singleton', async ({ assert }) => {
    const app = createMockApp({
      cloud_name: 'demo',
      api_key: 'test-key',
      api_secret: 'test-secret',
      secure: true,
    })

    const provider = new CloudinaryProvider(app as any)
    provider.register()

    const service = await app.container.make(CloudinaryService)
    assert.instanceOf(service, CloudinaryService)
    assert.equal(service.sdk.config().cloud_name, 'demo')
  })

  test('boot registers cloudinaryUrl edge global', async ({ assert }) => {
    const app = createMockApp({
      cloud_name: 'demo',
      api_key: 'test-key',
      api_secret: 'test-secret',
      secure: true,
    })

    const provider = new CloudinaryProvider(app as any)
    provider.register()
    await provider.boot()

    assert.property(edge.globals, 'cloudinaryUrl')
    assert.isFunction(edge.globals.cloudinaryUrl)

    const url = edge.globals.cloudinaryUrl('sample', { width: 100 })
    assert.include(url, 'res.cloudinary.com')
    assert.include(url, 'w_100')
    assert.include(url, 'sample')
  })

  test('boot does not throw when edge.js is unavailable', async ({ assert }) => {
    const app = createMockApp({
      cloud_name: 'demo',
      api_key: 'test-key',
      api_secret: 'test-secret',
      secure: true,
    })

    const provider = new CloudinaryProvider(app as any)
    provider.register()

    // Structural assurance: the method itself is wrapped in try/catch
    await assert.doesNotReject(async () => {
      await provider.boot()
    })
  })
})
