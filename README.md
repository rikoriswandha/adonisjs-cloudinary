# @rikology/adonisjs-cloudinary

Cloudinary integration for AdonisJS v7 — upload, transform, and deliver media through the Cloudinary v2 SDK, with first-class IoC container support, Edge templating helpers, and an optional FlyDrive bridge.

## Installation

```sh
bun add @rikology/adonisjs-cloudinary
node ace configure @rikology/adonisjs-cloudinary
```

The configure command will:

1. Create `config/cloudinary.ts` with your environment variables
2. Register the `CloudinaryProvider` in `adonisrc.ts`

## Environment Variables

Add the following to your `.env` file (values available from the [Cloudinary console](https://cloudinary.com/console)):

| Variable                | Required | Description                |
| ----------------------- | -------- | -------------------------- |
| `CLOUDINARY_CLOUD_NAME` | Yes      | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY`    | Yes      | Your Cloudinary API key    |
| `CLOUDINARY_API_SECRET` | Yes      | Your Cloudinary API secret |

Make sure these are also listed in your `.env.types` or `env.ts` file so AdonisJS can validate them at boot.

## Configuration

The configure command generates `config/cloudinary.ts`:

```ts
import env from '#start/env'
import { defineConfig } from '@rikology/adonisjs-cloudinary'

export default defineConfig({
  cloudName: env.get('CLOUDINARY_CLOUD_NAME'),
  apiKey: env.get('CLOUDINARY_API_KEY'),
  apiSecret: env.get('CLOUDINARY_API_SECRET'),
  secure: true,
})
```

`defineConfig` validates required fields and maps the camelCase keys you write to the snake_case format the Cloudinary SDK expects.

## Usage

### Dependency Injection

The `CloudinaryService` is bound to the IoC container as `cloudinary`. Inject it anywhere using `@inject()`:

```ts
import { inject } from '@adonisjs/core'
import type { CloudinaryService } from '@rikology/adonisjs-cloudinary'

@inject()
export default class UploadsController {
  constructor(protected cloudinary: CloudinaryService) {}

  async store({ request, response }) {
    const file = request.file('avatar')!

    const result = await this.cloudinary.uploadImage(file.tmpPath!, {
      folder: 'avatars',
      transformation: { width: 200, height: 200, crop: 'fill' },
    })

    return response.ok({ url: result.secure_url, publicId: result.public_id })
  }
}
```

### Edge Templates

The provider registers an `cloudinaryUrl` global in Edge when `edge.js` is installed. Use it to generate transformed delivery URLs directly in your templates:

```edge
<img
  src="{{ cloudinaryUrl('avatars/photo', { width: 200, height: 200, crop: 'fill' }) }}"
  alt="Avatar"
/>
```

The helper is not registered in API-only apps that don't use Edge — the provider handles this gracefully.

### Direct Container Resolution

You can also resolve the service from the container outside of controllers:

```ts
const cloudinary = await app.container.make('cloudinary')
const url = cloudinary.transformUrl('my-folder/my-image', { width: 500, crop: 'limit' })
```

## API Reference

### `CloudinaryService`

All methods delegate to the Cloudinary v2 SDK.

| Method                                     | Description                                           |
| ------------------------------------------ | ----------------------------------------------------- |
| `sdk`                                      | Raw `cloudinary` v2 object for direct SDK calls       |
| `uploadImage(file, options?)`              | Upload with `resource_type: 'image'`                  |
| `uploadVideo(file, options?)`              | Upload with `resource_type: 'video'`                  |
| `uploadFile(file, options?)`               | Upload with `resource_type: 'raw'`                    |
| `transformUrl(publicId, transformations?)` | Generate a delivery URL with optional transformations |
| `signedUrl(publicId, options?)`            | Generate a signed URL, optionally with `expiresAt`    |
| `uploadStream(options?)`                   | Return a `cloudinary.uploader.upload_stream()` stream |
| `destroy(publicId, options?)`              | Delete an asset (defaults `resource_type: 'image'`)   |

#### `uploadImage` / `uploadVideo` / `uploadFile`

```ts
const result = await cloudinary.uploadImage('/path/to/file.jpg', {
  folder: 'uploads',
  public_id: 'custom-name',
  tags: ['profile'],
})

// result.secure_url — the uploaded asset URL
// result.public_id — the Cloudinary public ID
```

All three methods accept the full range of [Cloudinary upload options](https://cloudinary.com/documentation/image_upload_api_reference#upload).

#### `transformUrl`

```ts
const url = cloudinary.transformUrl('my-image', {
  width: 300,
  height: 200,
  crop: 'fill',
  gravity: 'face',
  radius: 'max',
})

// https://res.cloudinary.com/demo/image/upload/c_fill,g_face,h_200,r_max,w_300/my-image
```

Accepts the full [Cloudinary transformation options](https://cloudinary.com/documentation/transformation_reference) object.

#### `signedUrl`

```ts
// Signed URL that expires in 1 hour
const url = cloudinary.signedUrl('private-doc', {
  expiresAt: Date.now() / 1000 + 3600,
})
```

Pass `expiresAt` as a Unix timestamp (seconds) or a `Date` object.

#### `destroy`

```ts
await cloudinary.destroy('my-folder/my-image')

// For non-image assets, specify the resource type:
await cloudinary.destroy('my-folder/my-video', { resource_type: 'video' })
```

### Standalone Helpers

For use cases outside the AdonisJS container (scripts, workers, etc.):

```ts
import { createCloudinaryService, transformUrl } from '@rikology/adonisjs-cloudinary'

// Create a service directly
const cloudinary = createCloudinaryService({
  cloudName: 'demo',
  apiKey: '123456',
  apiSecret: 'secret',
})

// One-shot URL generation
const url = transformUrl(
  'my-image',
  { cloudName: 'demo', apiKey: '123456', apiSecret: 'secret' },
  { width: 200, crop: 'thumb' }
)
```

## Drive Bridge

An optional FlyDrive driver is available for apps that use `@adonisjs/drive` or `flydrive`. It wraps `CloudinaryService` and maps FlyDrive operations to Cloudinary API calls.

### Setup

Register the driver in `config/drive.ts`:

```ts
import env from '#start/env'
import { defineConfig } from '@adonisjs/drive'
import { CloudinaryDrive } from '@rikology/adonisjs-cloudinary/drive'
import cloudinaryService from '@adonisjs/main' // or resolve via container

export default defineConfig({
  disks: {
    cloudinary: {
      driver: new CloudinaryDrive(cloudinaryService),
      visibility: 'public',
    },
  },
})
```

> The Drive bridge requires the optional `flydrive` peer dependency. Install it (`bun add flydrive`) only if you use this bridge; the rest of the package works without it.

Or resolve the service from the IoC container:

```ts
const cloudinary = await app.container.make('cloudinary')
const drive = new CloudinaryDrive(cloudinary)
```

### Supported Operations

| Method              | Behavior                                                      |
| ------------------- | ------------------------------------------------------------- |
| `exists(key)`       | Searches via the Admin API (rate-limited, avoid in hot paths) |
| `getUrl(key)`       | Returns the delivery URL via `transformUrl`                   |
| `getSignedUrl`      | Delegates to `signedUrl` with `expiresIn` → timestamp math    |
| `put(key, data)`    | Base64-encodes contents and uploads as a data URI             |
| `putStream(key)`    | Pipes a stream through `uploadStream`                         |
| `move(src, dest)`   | Calls `cloudinary.uploader.rename`                            |
| `delete(key)`       | Delegates to `destroy`                                        |
| `deleteAll(prefix)` | Lists resources by prefix, deletes each                       |
| `listAll(prefix)`   | Returns `DriveFile` objects by prefix                         |
| `getMetaData(key)`  | Returns `contentType`, `contentLength`, `lastModified`        |

### Unsupported Operations

| Method                           | Reason                                                       |
| -------------------------------- | ------------------------------------------------------------ |
| `get` / `getStream` / `getBytes` | Cloudinary is not a byte-level storage backend               |
| `copy`                           | Cloudinary has no server-side copy API                       |
| `setVisibility`                  | Visibility is managed via access-control rules, not per-file |
| `getSignedUploadUrl`             | Use Cloudinary upload presets or direct SDK calls instead    |

## Advanced: Raw SDK Access

If you need functionality not covered by the service methods, access the underlying SDK directly:

```ts
const cloudinary = await app.container.make('cloudinary')

// Admin API
const resources = await cloudinary.sdk.api.resources({
  type: 'upload',
  prefix: 'my-folder/',
  max_results: 50,
})

// Search API
const results = await cloudinary.sdk.search
  .expression('resource_type:image AND tags=featured')
  .sort_by('created_at', 'desc')
  .max_results(30)
  .execute()

// Upload presets
await cloudinary.sdk.uploader.upload(file, { upload_preset: 'my-preset' })
```

The `sdk` getter returns the full `cloudinary` v2 object — every SDK method is available.

## License

[MIT](LICENSE.md)
