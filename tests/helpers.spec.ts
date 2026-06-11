import { test } from '@japa/runner'
import sinon from 'sinon'
import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryService } from '../src/cloudinary_service.js'
import { createCloudinaryService, transformUrl } from '../src/helpers.js'

test.group('createCloudinaryService', (group) => {
  const sandbox = sinon.createSandbox()

  group.each.teardown(() => {
    sandbox.restore()
  })

  test('returns a CloudinaryService instance', ({ assert }) => {
    const service = createCloudinaryService({
      cloudName: 'demo',
      apiKey: 'key',
      apiSecret: 'secret',
    })
    assert.instanceOf(service, CloudinaryService)
  })

  test('service has working sdk getter', ({ assert }) => {
    const service = createCloudinaryService({
      cloudName: 'demo',
      apiKey: 'key',
      apiSecret: 'secret',
    })
    assert.equal(service.sdk, cloudinary)
  })
})

test.group('transformUrl (standalone helper)', (group) => {
  const sandbox = sinon.createSandbox()

  group.each.teardown(() => {
    sandbox.restore()
  })

  test('generates a URL without manually creating a service', ({ assert }) => {
    const urlStub = sandbox
      .stub(cloudinary, 'url')
      .returns('https://res.cloudinary.com/demo/image/upload/w_300/sample.jpg')

    const url = transformUrl('sample', {
      cloudName: 'demo',
      apiKey: 'key',
      apiSecret: 'secret',
    })
    assert.equal(url, 'https://res.cloudinary.com/demo/image/upload/w_300/sample.jpg')
    assert.isTrue(urlStub.calledOnce)
    assert.equal(urlStub.firstCall.args[0], 'sample')
  })

  test('passes transformations through to cloudinary.url()', ({ assert }) => {
    const urlStub = sandbox
      .stub(cloudinary, 'url')
      .returns('https://res.cloudinary.com/demo/image/upload/w_200,h_150/photo.jpg')

    transformUrl('photo', {
      cloudName: 'demo',
      apiKey: 'key',
      apiSecret: 'secret',
    }, { width: 200, height: 150 })

    assert.deepEqual(urlStub.firstCall.args[1], { width: 200, height: 150 })
  })

  test('creates a new service each call (stateless)', ({ assert }) => {
    const urlStub = sandbox
      .stub(cloudinary, 'url')
      .returns('https://res.cloudinary.com/demo/image/upload/test')

    const config = { cloudName: 'demo', apiKey: 'key', apiSecret: 'secret' }
    transformUrl('test1', config)
    transformUrl('test2', config)

    // Two separate calls → two invocations of cloudinary.url
    assert.equal(urlStub.callCount, 2)
    assert.equal(urlStub.firstCall.args[0], 'test1')
    assert.equal(urlStub.secondCall.args[0], 'test2')
  })
})
