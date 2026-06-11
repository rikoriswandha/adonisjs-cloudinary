import { test } from '@japa/runner'
import sinon from 'sinon'
import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryService } from '../src/cloudinary_service.js'

test.group('CloudinaryService', (group) => {
  const sandbox = sinon.createSandbox()

  group.each.setup(() => {
    sandbox.restore()
  })

  test('constructor calls cloudinary.config()', ({ assert }) => {
    const configStub = sandbox.stub(cloudinary, 'config')
    new CloudinaryService({
      cloud_name: 'demo',
      api_key: 'key',
      api_secret: 'secret',
      secure: true,
    })
    assert.isTrue(configStub.calledOnce)
    assert.deepEqual(configStub.firstCall.args[0], {
      cloud_name: 'demo',
      api_key: 'key',
      api_secret: 'secret',
      secure: true,
    })
  })

  test('sdk getter returns raw cloudinary v2 object', ({ assert }) => {
    sandbox.stub(cloudinary, 'config')
    const service = new CloudinaryService({
      cloud_name: 'demo',
      api_key: 'key',
      api_secret: 'secret',
    })
    assert.equal(service.sdk, cloudinary)
  })

  test('uploadImage passes resource_type: image', async ({ assert }) => {
    sandbox.stub(cloudinary, 'config')
    const uploadStub = sandbox.stub(cloudinary.uploader, 'upload').resolves({ public_id: 'img' } as any)
    const service = new CloudinaryService({ cloud_name: 'demo', api_key: 'key', api_secret: 'secret' })

    await service.uploadImage('path/to/image.jpg')
    assert.isTrue(uploadStub.calledOnce)
    assert.deepEqual(uploadStub.firstCall.args[1], { resource_type: 'image' })
  })

  test('uploadVideo passes resource_type: video', async ({ assert }) => {
    sandbox.stub(cloudinary, 'config')
    const uploadStub = sandbox.stub(cloudinary.uploader, 'upload').resolves({ public_id: 'vid' } as any)
    const service = new CloudinaryService({ cloud_name: 'demo', api_key: 'key', api_secret: 'secret' })

    await service.uploadVideo('path/to/video.mp4')
    assert.isTrue(uploadStub.calledOnce)
    assert.deepEqual(uploadStub.firstCall.args[1], { resource_type: 'video' })
  })

  test('uploadFile passes resource_type: raw', async ({ assert }) => {
    sandbox.stub(cloudinary, 'config')
    const uploadStub = sandbox.stub(cloudinary.uploader, 'upload').resolves({ public_id: 'file' } as any)
    const service = new CloudinaryService({ cloud_name: 'demo', api_key: 'key', api_secret: 'secret' })

    await service.uploadFile('path/to/file.pdf')
    assert.isTrue(uploadStub.calledOnce)
    assert.deepEqual(uploadStub.firstCall.args[1], { resource_type: 'raw' })
  })

  test('upload methods merge custom options', async ({ assert }) => {
    sandbox.stub(cloudinary, 'config')
    const uploadStub = sandbox.stub(cloudinary.uploader, 'upload').resolves({ public_id: 'img' } as any)
    const service = new CloudinaryService({ cloud_name: 'demo', api_key: 'key', api_secret: 'secret' })

    await service.uploadImage('path/to/image.jpg', { folder: 'avatars', public_id: 'avatar' })
    assert.deepEqual(uploadStub.firstCall.args[1], {
      resource_type: 'image',
      folder: 'avatars',
      public_id: 'avatar',
    })
  })

  test('transformUrl delegates to cloudinary.url()', ({ assert }) => {
    sandbox.stub(cloudinary, 'config')
    const urlStub = sandbox.stub(cloudinary, 'url').returns('https://res.cloudinary.com/demo/image/upload/sample.jpg')
    const service = new CloudinaryService({ cloud_name: 'demo', api_key: 'key', api_secret: 'secret' })

    service.transformUrl('sample', { width: 300 })
    assert.isTrue(urlStub.calledOnce)
    assert.equal(urlStub.firstCall.args[0], 'sample')
    assert.deepEqual(urlStub.firstCall.args[1], { width: 300 })
  })

  test('signedUrl sets sign_url: true', ({ assert }) => {
    sandbox.stub(cloudinary, 'config')
    const urlStub = sandbox.stub(cloudinary, 'url').returns('https://signed.url')
    const service = new CloudinaryService({ cloud_name: 'demo', api_key: 'key', api_secret: 'secret' })

    service.signedUrl('private_img')
    assert.isTrue(urlStub.calledOnce)
    assert.deepEqual(urlStub.firstCall.args[1], { sign_url: true })
  })

  test('signedUrl converts Date expiresAt to unix seconds', ({ assert }) => {
    sandbox.stub(cloudinary, 'config')
    const urlStub = sandbox.stub(cloudinary, 'url').returns('https://signed.url')
    const service = new CloudinaryService({ cloud_name: 'demo', api_key: 'key', api_secret: 'secret' })

    const expiresAt = new Date('2030-01-01T00:00:00Z')
    service.signedUrl('private_img', { expiresAt })
    assert.deepEqual(urlStub.firstCall.args[1], {
      sign_url: true,
      expires_at: Math.floor(expiresAt.getTime() / 1000),
    })
  })

  test('signedUrl passes numeric expiresAt directly', ({ assert }) => {
    sandbox.stub(cloudinary, 'config')
    const urlStub = sandbox.stub(cloudinary, 'url').returns('https://signed.url')
    const service = new CloudinaryService({ cloud_name: 'demo', api_key: 'key', api_secret: 'secret' })

    service.signedUrl('private_img', { expiresAt: 1893456000 })
    assert.deepEqual(urlStub.firstCall.args[1], {
      sign_url: true,
      expires_at: 1893456000,
    })
  })

  test('uploadStream delegates to cloudinary.uploader.upload_stream', ({ assert }) => {
    sandbox.stub(cloudinary, 'config')
    const streamStub = sandbox.stub(cloudinary.uploader, 'upload_stream').returns({} as any)
    const service = new CloudinaryService({ cloud_name: 'demo', api_key: 'key', api_secret: 'secret' })

    service.uploadStream({ folder: 'uploads' })
    assert.isTrue(streamStub.calledOnce)
    assert.deepEqual(streamStub.firstCall.args[0], { folder: 'uploads' })
  })

  test('destroy defaults resource_type to image', async ({ assert }) => {
    sandbox.stub(cloudinary, 'config')
    const destroyStub = sandbox.stub(cloudinary.uploader, 'destroy').resolves({ result: 'ok' } as any)
    const service = new CloudinaryService({ cloud_name: 'demo', api_key: 'key', api_secret: 'secret' })

    await service.destroy('old_image')
    assert.isTrue(destroyStub.calledOnce)
    assert.equal(destroyStub.firstCall.args[0], 'old_image')
    assert.deepEqual(destroyStub.firstCall.args[1], { resource_type: 'image' })
  })

  test('destroy merges custom options', async ({ assert }) => {
    sandbox.stub(cloudinary, 'config')
    const destroyStub = sandbox.stub(cloudinary.uploader, 'destroy').resolves({ result: 'ok' } as any)
    const service = new CloudinaryService({ cloud_name: 'demo', api_key: 'key', api_secret: 'secret' })

    await service.destroy('old_video', { resource_type: 'video', invalidate: true })
    assert.deepEqual(destroyStub.firstCall.args[1], { resource_type: 'video', invalidate: true })
  })
})
