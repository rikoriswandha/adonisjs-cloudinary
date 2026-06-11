import { test } from '@japa/runner'
import { defineConfig } from '../src/cloudinary_config.js'

test.group('defineConfig', () => {
  test('maps camelCase to snake_case', ({ assert }) => {
    const result = defineConfig({
      cloudName: 'demo',
      apiKey: 'key',
      apiSecret: 'secret',
    })
    assert.deepEqual(result, {
      cloud_name: 'demo',
      api_key: 'key',
      api_secret: 'secret',
      secure: true,
    })
  })

  test('defaults secure to true', ({ assert }) => {
    const result = defineConfig({
      cloudName: 'demo',
      apiKey: 'key',
      apiSecret: 'secret',
    })
    assert.equal(result.secure, true)
  })

  test('allows secure to be set to false', ({ assert }) => {
    const result = defineConfig({
      cloudName: 'demo',
      apiKey: 'key',
      apiSecret: 'secret',
      secure: false,
    })
    assert.equal(result.secure, false)
  })

  test('throws when cloudName is missing', ({ assert }) => {
    assert.throws(
      () => defineConfig({ cloudName: '', apiKey: 'key', apiSecret: 'secret' }),
      /missing required field: cloudName/
    )
  })

  test('throws when apiKey is missing', ({ assert }) => {
    assert.throws(
      () => defineConfig({ cloudName: 'demo', apiKey: '', apiSecret: 'secret' }),
      /missing required field: apiKey/
    )
  })

  test('throws when apiSecret is missing', ({ assert }) => {
    assert.throws(
      () => defineConfig({ cloudName: 'demo', apiKey: 'key', apiSecret: '' }),
      /missing required field: apiSecret/
    )
  })
})
