import { test } from '@japa/runner'
import sinon from 'sinon'
import { Readable } from 'node:stream'
import { CloudinaryDrive } from '../src/drive/cloudinary_drive.js'

/**
 * Build a mock CloudinaryService with overridable stubs.
 */
function mockService(
  stubs: {
    sdk?: any
    transformUrl?: (publicId: string, transformations?: any) => string
    signedUrl?: (publicId: string, options?: any) => string
    uploadStream?: (options?: any) => any
    destroy?: (publicId: string, options?: any) => Promise<any>
  } = {}
) {
  return {
    sdk: stubs.sdk ?? {},
    transformUrl: stubs.transformUrl ?? (() => ''),
    signedUrl: stubs.signedUrl ?? (() => ''),
    uploadStream: stubs.uploadStream ?? (() => ({ pipe: () => ({ on: () => {} }) })),
    destroy: stubs.destroy ?? (() => Promise.resolve({ result: 'ok' })),
  } as any
}

test.group('CloudinaryDrive', (group) => {
  const sandbox = sinon.createSandbox()

  group.each.setup(() => {
    sandbox.restore()
  })

  test('exists returns true when resource is found', async ({ assert }) => {
    const resourcesStub = sandbox.stub().resolves({
      resources: [{ public_id: 'demo.jpg' }],
    })
    const service = mockService({
      sdk: { api: { resources: resourcesStub } },
    })

    const drive = new CloudinaryDrive(service)
    const result = await drive.exists('demo.jpg')
    assert.isTrue(result)
    assert.isTrue(
      resourcesStub.calledOnceWithExactly({ type: 'upload', prefix: 'demo.jpg', max_results: 1 })
    )
  })

  test('exists returns false when resource is not found', async ({ assert }) => {
    const service = mockService({
      sdk: { api: { resources: sandbox.stub().resolves({ resources: [] }) } },
    })

    const drive = new CloudinaryDrive(service)
    const result = await drive.exists('missing.jpg')
    assert.isFalse(result)
  })

  test('get throws descriptive error', async ({ assert }) => {
    const drive = new CloudinaryDrive(mockService())
    await assert.rejects(() => drive.get('file.jpg'), /does not support raw content retrieval/)
  })

  test('getStream throws descriptive error', async ({ assert }) => {
    const drive = new CloudinaryDrive(mockService())
    await assert.rejects(
      () => drive.getStream('file.jpg'),
      /does not support raw content retrieval/
    )
  })

  test('getBytes throws descriptive error', async ({ assert }) => {
    const drive = new CloudinaryDrive(mockService())
    await assert.rejects(() => drive.getBytes('file.jpg'), /does not support raw content retrieval/)
  })

  test('getMetaData returns mapped metadata', async ({ assert }) => {
    const service = mockService({
      sdk: {
        api: {
          resources: sandbox.stub().resolves({
            resources: [
              {
                public_id: 'demo.jpg',
                resource_type: 'image',
                bytes: 1234,
                created_at: '2024-01-01T00:00:00Z',
                version: 42,
              },
            ],
          }),
        },
      },
    })

    const drive = new CloudinaryDrive(service)
    const meta = await drive.getMetaData('demo.jpg')
    assert.equal(meta.contentType, 'image')
    assert.equal(meta.contentLength, 1234)
    assert.instanceOf(meta.lastModified, Date)
    assert.equal(meta.etag, '42')
  })

  test('getMetaData throws when resource does not exist', async ({ assert }) => {
    const service = mockService({
      sdk: { api: { resources: sandbox.stub().resolves({ resources: [] }) } },
    })

    const drive = new CloudinaryDrive(service)
    await assert.rejects(() => drive.getMetaData('missing.jpg'), /does not exist/)
  })

  test('getVisibility returns public', async ({ assert }) => {
    const drive = new CloudinaryDrive(mockService())
    const visibility = await drive.getVisibility('any.jpg')
    assert.equal(visibility, 'public')
  })

  test('getUrl delegates to transformUrl', async ({ assert }) => {
    const transformStub = sandbox
      .stub()
      .returns('https://res.cloudinary.com/demo/image/upload/demo.jpg')
    const service = mockService({ transformUrl: transformStub })

    const drive = new CloudinaryDrive(service)
    const url = await drive.getUrl('demo.jpg')
    assert.equal(url, 'https://res.cloudinary.com/demo/image/upload/demo.jpg')
    assert.isTrue(transformStub.calledOnceWithExactly('demo.jpg'))
  })

  test('getSignedUrl delegates to signedUrl with expiresAt math', async ({ assert }) => {
    const signedStub = sandbox.stub().returns('https://signed.url')
    const service = mockService({ signedUrl: signedStub })

    const drive = new CloudinaryDrive(service)
    const url = await drive.getSignedUrl('demo.jpg', { expiresIn: 300 })
    assert.equal(url, 'https://signed.url')

    const callArgs = signedStub.firstCall.args
    assert.equal(callArgs[0], 'demo.jpg')
    assert.exists(callArgs[1].expiresAt)
    assert.isNumber(callArgs[1].expiresAt)
  })

  test('getSignedUrl passes undefined expiresAt when no expiresIn given', async ({ assert }) => {
    const signedStub = sandbox.stub().returns('https://signed.url')
    const service = mockService({ signedUrl: signedStub })

    const drive = new CloudinaryDrive(service)
    await drive.getSignedUrl('demo.jpg')
    assert.isTrue(signedStub.calledOnceWithExactly('demo.jpg', { expiresAt: undefined }))
  })

  test('getSignedUploadUrl throws', async ({ assert }) => {
    const drive = new CloudinaryDrive(mockService())
    await assert.rejects(
      () => drive.getSignedUploadUrl('demo.jpg'),
      /does not support getSignedUploadUrl/
    )
  })

  test('setVisibility is a NOOP', async ({ assert }) => {
    const drive = new CloudinaryDrive(mockService())
    await assert.doesNotReject(() => drive.setVisibility('demo.jpg', 'public'))
    await assert.doesNotReject(() => drive.setVisibility('demo.jpg', 'private'))
  })

  test('put uploads base64 data URI', async ({ assert }) => {
    const uploadStub = sandbox.stub().resolves({ public_id: 'demo.txt' })
    const service = mockService({
      sdk: { uploader: { upload: uploadStub } },
    })

    const drive = new CloudinaryDrive(service)
    await drive.put('demo.txt', 'hello world')
    assert.isTrue(uploadStub.calledOnce)
    const [dataUri, options] = uploadStub.firstCall.args
    assert.isTrue(dataUri.startsWith('data:text/plain;base64,'))
    assert.deepEqual(options, { public_id: 'demo.txt' })
  })

  test('put uses custom contentType from WriteOptions', async ({ assert }) => {
    const uploadStub = sandbox.stub().resolves({ public_id: 'demo.json' })
    const service = mockService({
      sdk: { uploader: { upload: uploadStub } },
    })

    const drive = new CloudinaryDrive(service)
    await drive.put('demo.json', '{"a":1}', { contentType: 'application/json' })
    const [dataUri] = uploadStub.firstCall.args
    assert.isTrue(dataUri.startsWith('data:application/json;base64,'))
  })

  test('putStream pipes through uploadStream', async ({ assert }) => {
    const { PassThrough } = await import('node:stream')
    const stream = new PassThrough()
    const uploadStreamStub = sandbox.stub().returns(stream)
    const service = mockService({ uploadStream: uploadStreamStub })

    const drive = new CloudinaryDrive(service)
    const readable = Readable.from(['hello'])
    const promise = drive.putStream('demo.txt', readable)

    // End the stream to trigger finish
    stream.end()
    await promise

    assert.isTrue(uploadStreamStub.calledOnceWithExactly({ public_id: 'demo.txt' }))
  })

  test('copy throws unsupported error', async ({ assert }) => {
    const drive = new CloudinaryDrive(mockService())
    await assert.rejects(() => drive.copy('a.jpg', 'b.jpg'), /does not support server-side copy/)
  })

  test('move delegates to uploader.rename', async ({ assert }) => {
    const renameStub = sandbox.stub().resolves({ public_id: 'b.jpg' })
    const service = mockService({
      sdk: { uploader: { rename: renameStub } },
    })

    const drive = new CloudinaryDrive(service)
    await drive.move('a.jpg', 'b.jpg')
    assert.isTrue(renameStub.calledOnceWithExactly('a.jpg', 'b.jpg'))
  })

  test('delete delegates to destroy', async ({ assert }) => {
    const destroyStub = sandbox.stub().resolves({ result: 'ok' })
    const service = mockService({ destroy: destroyStub })

    const drive = new CloudinaryDrive(service)
    await drive.delete('demo.jpg')
    assert.isTrue(destroyStub.calledOnceWithExactly('demo.jpg'))
  })

  test('deleteAll lists and destroys matching resources', async ({ assert }) => {
    const destroyStub = sandbox.stub().resolves({ result: 'ok' })
    const service = mockService({
      sdk: {
        api: {
          resources: sandbox.stub().resolves({
            resources: [{ public_id: 'folder/a.jpg' }, { public_id: 'folder/b.jpg' }],
          }),
        },
      },
      destroy: destroyStub,
    })

    const drive = new CloudinaryDrive(service)
    await drive.deleteAll('folder/')
    assert.equal(destroyStub.callCount, 2)
    assert.isTrue(destroyStub.calledWith('folder/a.jpg'))
    assert.isTrue(destroyStub.calledWith('folder/b.jpg'))
  })

  test('listAll returns DriveFile instances', async ({ assert }) => {
    const service = mockService({
      sdk: {
        api: {
          resources: sandbox.stub().resolves({
            resources: [{ public_id: 'folder/a.jpg' }, { public_id: 'folder/b.jpg' }],
          }),
        },
      },
    })

    const drive = new CloudinaryDrive(service)
    const result = await drive.listAll('folder/')
    assert.isUndefined(result.paginationToken)
    const objects = Array.from(result.objects)
    assert.equal(objects.length, 2)
    assert.equal(objects[0].key, 'folder/a.jpg')
    assert.equal(objects[1].key, 'folder/b.jpg')
    assert.isTrue(objects[0].isFile)
    assert.isFalse(objects[0].isDirectory)
  })

  test('bucket returns self', async ({ assert }) => {
    const drive = new CloudinaryDrive(mockService())
    assert.equal(drive.bucket('other'), drive)
  })
})
