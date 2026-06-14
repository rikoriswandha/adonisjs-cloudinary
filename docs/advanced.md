# Advanced

The convenience methods on `CloudinaryService` cover the 80% case. When you need more, the full Cloudinary v2 SDK is one property away — and this document walks through the patterns that don't fit the thin wrappers.

## Raw SDK access

The `sdk` getter returns the live `cloudinary.v2` object, so every SDK namespace is available:

```ts
const cloudinary = await app.container.make('cloudinary')

cloudinary.sdk.uploader   // upload, upload_stream, destroy, rename, explicit, ...
cloudinary.sdk.api        // resources, resource, delete_resources, ...
cloudinary.sdk.search     // .expression().sort_by().max_results().execute()
cloudinary.sdk.url        // lower-level URL generation
cloudinary.sdk.config()   // read current module-level config
```

Because the SDK is configured by the `CloudinaryService` constructor, the credentials and `cloud_name` are already wired up — you don't pass them again.

## Admin API

### List resources

```ts
const resources = await cloudinary.sdk.api.resources({
  type: 'upload',
  prefix: 'avatars/',
  max_results: 50,
  next_cursor: undefined, // paginate
})
```

### Fetch a single resource's details

```ts
const detail = await cloudinary.sdk.api.resource('avatars/user-42', {
  resource_type: 'image',
})
// detail.public_id, detail.bytes, detail.format, detail.created_at,
// detail.derived (generated variants), detail.context, detail.tags ...
```

### Delete by tag or prefix

```ts
await cloudinary.sdk.api.delete_resources_by_tag('temp')
await cloudinary.sdk.api.delete_resources_by_prefix('staging/')
```

> The Admin API is rate-limited more strictly than Upload/Delivery. Cache results and batch operations where you can.

## Search API

Cloudinary's [Search API](https://cloudinary.com/documentation/search_api) is a fluent builder. It supports Lucene-like expressions over structured asset metadata.

```ts
const results = await cloudinary.sdk.search
  .expression('resource_type:image AND tags=featured')
  .sort_by('created_at', 'desc')
  .max_results(30)
  .execute()

// results.resources[].public_id, .secure_url, .tags, .context ...
```

This is the most efficient way to build galleries, dashboards, or "recent uploads" views without a local database mirror.

## Upload presets

Upload presets let you move transformation, tagging, and access rules into Cloudinary-managed configuration. Reference one by name instead of sending signed options:

```ts
await cloudinary.sdk.uploader.upload(file.tmpPath, {
  upload_preset: 'unsigned-avatar',
})
```

Unsigned presets can be used directly from the browser (eager upload) without exposing your API secret — useful for client-side uploads.

## Explicit transformations & eager generation

Generate derived (transformed) versions at upload time or on demand:

```ts
// At upload time
await cloudinary.uploadImage(file, {
  folder: 'products',
  eager: [{ width: 400, crop: 'scale' }, { width: 800, crop: 'scale' }],
})

// On an existing asset
await cloudinary.sdk.uploader.explicit('products/sneaker', {
  type: 'upload',
  eager: [{ width: 1200, crop: 'limit' }],
})
```

## Contextual metadata

Attach structured key/value metadata to an asset (searchable via the Search API):

```ts
await cloudinary.uploadImage(file, {
  folder: 'media',
  context: { 'alt=en:Red sneakers on white background', 'category=en:footwear' },
})

// Query it later
await cloudinary.sdk.search
  .expression('context.category:footwear')
  .execute()
```

## Signed URL deep dive

[`signedUrl`](./service-api.md#signedurl) sets `sign_url: true` and maps `expiresAt` to the SDK's `expires_at`. A few things worth knowing:

- **`expiresAt` units.** A `Date` is converted to Unix **seconds** automatically; a number is assumed to already be Unix seconds.
- **Access mode.** The signature only restricts access when the asset (or the delivery type) is set to **authenticated** mode. A signed URL for a public asset is technically valid but does not gate anything.
- **Strict transformations.** Combine signed delivery with `strict_transformations` in Cloudinary to ensure transformations can only be applied via signed URLs.

```ts
// 10-minute signed URL
const url = cloudinary.signedUrl('private-doc', {
  expiresAt: new Date(Date.now() + 10 * 60 * 1000),
})
```

## Multiple cloud accounts

The Cloudinary v2 SDK stores its configuration **at the module level**. `CloudinaryService`'s constructor calls `cloudinary.config(...)`, so each construction reconfigures the shared module. This has a concrete consequence:

- **Sequential multi-account use works.** Call `createCloudinaryService(configA)`, do work, then `createCloudinaryService(configB)` and do more work. Each call rewrites the active config.
- **Concurrent multi-account use is unsafe** through the shared `CloudinaryService`, because two in-flight operations would race on the module-global config.

For true concurrent multi-account work, bypass the service and invoke the SDK with per-call config:

```ts
import { v2 as cloudinary } from 'cloudinary'

// Per-call config — does not mutate the shared module state
const result = await cloudinary.uploader.upload(file, {
  cloud_name: accountB.cloudName,
  api_key: accountB.apiKey,
  api_secret: accountB.apiSecret,
  folder: 'account-b-assets',
})
```

For most apps (one Cloudinary account per environment), the singleton from the provider is exactly right and you never need to think about this.

## Testing

The project mocks the Cloudinary SDK with [`sinon`](https://sinonjs.org/) rather than making real network calls. The pattern used across the test suite:

```ts
import sinon from 'sinon'
import { v2 as cloudinary } from 'cloudinary'

const sandbox = sinon.createSandbox()

test('uploadImage sets resource_type', async ({ assert }) => {
  const uploadStub = sandbox.stub(cloudinary.uploader, 'upload').resolves({ public_id: 'x' })

  await service.uploadImage('/tmp/a.jpg', { folder: 'test' })

  assert.equal(uploadStub.firstCall.args[1].resource_type, 'image')
})
```

Restore sandboxes in `group.each.setup` / `group.each.teardown` to keep tests isolated.

## Related

- [Service API](./service-api.md) — the convenience surface this builds on.
- [Standalone Helpers](./standalone-helpers.md) — `createCloudinaryService` for scripts.
- [Drive Bridge](./drive-bridge.md) — where the raw `api` and `uploader` namespaces surface as FlyDrive ops.
