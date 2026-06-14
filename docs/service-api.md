# CloudinaryService API

`CloudinaryService` is the core of this package. It wraps the [Cloudinary v2 SDK](https://cloudinary.com/documentation/node_integration) and exposes a small, typed surface for the common operations, while the raw SDK remains one property away for everything else.

## Obtaining the service

The service is bound to the IoC container as a singleton under the key `cloudinary`.

### Dependency injection (controllers, middleware, services)

```ts
import { inject } from '@adonisjs/core'
import type { CloudinaryService } from '@rikology/adonisjs-cloudinary'

@inject()
export default class UploadsController {
  constructor(protected cloudinary: CloudinaryService) {}

  async store({ request, response }) {
    const result = await this.cloudinary.uploadImage(request.file('photo')!.tmpPath!)
    return response.ok(result)
  }
}
```

### Direct container resolution

```ts
import app from '@adonisjs/core/services/app'

const cloudinary = await app.container.make('cloudinary')
```

Both are fully typed thanks to the `ContainerBindings` augmentation — see [Configuration](./configuration.md#container-binding--type-augmentation).

## Constructor

```ts
class CloudinaryService {
  constructor(config: ConfigOptions)
}
```

You normally never instantiate this directly — the provider does it for you. For standalone use (scripts, workers, non-AdonisJS code) use [`createCloudinaryService`](./standalone-helpers.md), which accepts the friendlier `CloudinaryConfig` shape and runs validation.

## Properties

### `sdk`

```ts
get sdk(): typeof cloudinary
```

Returns the raw Cloudinary v2 SDK object (`cloudinary.v2`). Every SDK method is available — `uploader`, `api`, `search`, `url`, and the full config surface. See [Advanced: Raw SDK Access](./advanced.md).

```ts
const resources = await cloudinary.sdk.api.resources({ type: 'upload', max_results: 10 })
```

## Upload methods

All three upload helpers are thin wrappers around `cloudinary.uploader.upload()` that preset the `resource_type`. Any other [Cloudinary upload option](https://cloudinary.com/documentation/image_upload_api_reference#upload) is passed through.

### `uploadImage`

```ts
uploadImage(file: string, options?: UploadApiOptions): Promise<UploadApiResponse>
```

Uploads with `resource_type: 'image'`. `file` is a local file path.

```ts
const result = await cloudinary.uploadImage('/tmp/avatar.jpg', {
  folder: 'avatars',
  public_id: 'user-42',
  overwrite: true,
  tags: ['profile', 'user-42'],
})

// result.secure_url  → https://res.cloudinary.com/.../v1/avatars/user-42.jpg
// result.public_id   → avatars/user-42
// result.bytes       → 102934
// result.width, result.height, result.format ...
```

### `uploadVideo`

```ts
uploadVideo(file: string, options?: UploadApiOptions): Promise<UploadApiResponse>
```

Uploads with `resource_type: 'video'`. Use for video and audio assets.

```ts
const result = await cloudinary.uploadVideo(request.file('clip')!.tmpPath!, {
  folder: 'clips',
  resource_type: 'video', // already set; can still be overridden in options
})
```

### `uploadFile`

```ts
uploadFile(file: string, options?: UploadApiOptions): Promise<UploadApiResponse>
```

Uploads with `resource_type: 'raw'`. Use for non-media files (PDFs, archives, documents) that should not be processed or transformed.

```ts
const result = await cloudinary.uploadFile('/tmp/report.pdf', {
  folder: 'documents',
})
```

### Upload options & response

- **`options`** — the full [`UploadApiOptions`](https://cloudinary.com/documentation/image_upload_api_reference#upload) from the Cloudinary SDK. Common fields:

  | Option | Purpose |
  | --- | --- |
  | `folder` | Destination folder (becomes part of the `public_id`) |
  | `public_id` | Custom asset identifier |
  | `overwrite` | Overwrite an existing asset with the same `public_id` |
  | `tags` | Array of tags for search/Admin API |
  | `transformation` | Apply a transformation on upload |
  | `eager` | Generate derived assets eagerly |
  | `upload_preset` | Use an [upload preset](https://cloudinary.com/documentation/upload_presets) instead of signed options |

- **Return** — [`UploadApiResponse`](https://cloudinary.com/documentation/image_upload_api_reference#upload_response), including `public_id`, `secure_url`, `bytes`, `width`, `height`, `format`, `created_at`, `etag`, and more.

> The `resource_type` preset (`image`/`video`/`raw`) is spread **before** your `options`, so you can still override it explicitly if needed.

## URL generation

### `transformUrl`

```ts
transformUrl(publicId: string, transformations?: TransformationOptions): string
```

Generates a delivery URL for a `public_id`, optionally with [transformation options](https://cloudinary.com/documentation/transformation_reference). Returns a string synchronously.

```ts
cloudinary.transformUrl('my-image', {
  width: 300,
  height: 200,
  crop: 'fill',
  gravity: 'face',
  radius: 'max',
})
// https://res.cloudinary.com/demo/image/upload/c_fill,g_face,h_200,r_max,w_300/my-image
```

This is the same helper exposed to Edge as the `cloudinaryUrl` global — see [Edge Helpers](./edge-helpers.md).

### `signedUrl`

```ts
signedUrl(
  publicId: string,
  options?: { expiresAt?: Date | number } & Record<string, any>
): string
```

Generates a cryptographically signed delivery URL. Sets `sign_url: true` under the hood.

`expiresAt` accepts either a **`Date` object** or a **Unix timestamp in seconds** (number). It is converted to the SDK's `expires_at` option (seconds). Any other keys in `options` are passed through as URL/transformation options.

```ts
// Expires in 1 hour, computed from a Date
const url = cloudinary.signedUrl('private-doc', {
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
})

// Expires in 1 hour, as a Unix timestamp (seconds)
const url = cloudinary.signedUrl('private-doc', {
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
})

// Signed URL with a transformation
const url = cloudinary.signedUrl('private-photo', {
  expiresAt: new Date(Date.now() + 600_000),
  width: 800,
  crop: 'limit',
})
```

> Cloudinary requires the asset to be set to `access_mode: 'authenticated'` (or delivered through a [signed delivery](https://cloudinary.com/documentation/signatures#signed_delivery_urls) setup) for the signature to gate access. A signed URL for a fully-public asset is still valid but does not restrict access.

## Streaming upload

### `uploadStream`

```ts
uploadStream(options?: UploadApiOptions): UploadStream
```

Returns a writable stream (`cloudinary.uploader.upload_stream()`) you can pipe into. Useful for streaming uploads from a request body or a readable source without buffering to disk.

```ts
import { Readable } from 'node:stream'

const stream = cloudinary.uploadStream({ folder: 'streams' })

const result = await new Promise((resolve, reject) => {
  stream.on('finish', resolve)
  stream.on('error', reject)

  // pipe from any Readable: request body, S3, etc.
  Readable.from(buffer).pipe(stream)
})
```

For the AdonisJS request file path, `uploadImage`/`uploadVideo`/`uploadFile` with `file.tmpPath!` are usually simpler. Reach for `uploadStream` when you don't have a file on disk.

## Deletion

### `destroy`

```ts
destroy(publicId: string, options?: UploadApiOptions): Promise<any>
```

Deletes an asset by `public_id`. Defaults to `resource_type: 'image'`.

```ts
await cloudinary.destroy('avatars/user-42')

// Non-image assets require the matching resource_type
await cloudinary.destroy('clips/intro', { resource_type: 'video' })
await cloudinary.destroy('documents/report', { resource_type: 'raw' })
```

The return value is the raw [`destroy` response](https://cloudinary.com/documentation/image_upload_api_reference#destroy), typically `{ result: 'ok' }` or `{ result: 'not found' }`.

## Method summary

| Method | Returns | Description |
| --- | --- | --- |
| `sdk` | `typeof cloudinary` | Raw Cloudinary v2 SDK object |
| `uploadImage(file, options?)` | `Promise<UploadApiResponse>` | Upload with `resource_type: 'image'` |
| `uploadVideo(file, options?)` | `Promise<UploadApiResponse>` | Upload with `resource_type: 'video'` |
| `uploadFile(file, options?)` | `Promise<UploadApiResponse>` | Upload with `resource_type: 'raw'` |
| `transformUrl(publicId, transformations?)` | `string` | Delivery URL with optional transformations |
| `signedUrl(publicId, options?)` | `string` | Signed URL, optionally with `expiresAt` |
| `uploadStream(options?)` | `UploadStream` | Writable stream for streaming uploads |
| `destroy(publicId, options?)` | `Promise<any>` | Delete an asset (defaults to `image`) |

## Related

- [Configuration](./configuration.md) — how the service is constructed and bound.
- [Edge Helpers](./edge-helpers.md) — `transformUrl` exposed to templates.
- [Advanced](./advanced.md) — raw SDK, Admin/Search API.
