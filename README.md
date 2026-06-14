# @rikology/adonisjs-cloudinary

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE.md)
[![AdonisJS v7](https://img.shields.io/badge/AdonisJS-v7-purple.svg)](https://adonisjs.com)

Cloudinary integration for AdonisJS v7 — upload, transform, and deliver media through the Cloudinary v2 SDK, with first-class IoC container support, Edge templating helpers, and an optional FlyDrive bridge.

## Features

- 🚀 **Typed service** wrapping the Cloudinary v2 SDK, injectable anywhere via the IoC container
- 📸 **Upload helpers** for images, video, and raw files with a single call
- 🎨 **URL transformations** generated synchronously, including in Edge templates
- 🔐 **Signed/expiring URLs** with `Date` or Unix-timestamp expiration
- 🗄️ **Optional FlyDrive bridge** to use Cloudinary as a Drive disk
- 🧩 **Zero-config Edge helper** that registers itself when Edge is installed (and stays out of the way in API-only apps)
- 📦 **Standalone helpers** for scripts, workers, and non-AdonisJS projects

## Documentation

| Topic | Document |
| --- | --- |
| Install, configure, first upload | [Getting Started](./docs/getting-started.md) |
| `defineConfig`, config types, container binding | [Configuration](./docs/configuration.md) |
| Full `CloudinaryService` method reference | [Service API](./docs/service-api.md) |
| The `cloudinaryUrl` Edge global | [Edge Helpers](./docs/edge-helpers.md) |
| Using Cloudinary as a FlyDrive disk | [Drive Bridge](./docs/drive-bridge.md) |
| Scripts, workers, non-AdonisJS usage | [Standalone Helpers](./docs/standalone-helpers.md) |
| Raw SDK, Admin/Search API, presets, multi-account | [Advanced](./docs/advanced.md) |
| Avatars, galleries, signed URLs, cleanup | [Recipes](./docs/recipes.md) |

## Installation

```sh
# npm
npm install @rikology/adonisjs-cloudinary

# pnpm
pnpm add @rikology/adonisjs-cloudinary

# yarn
yarn add @rikology/adonisjs-cloudinary

# bun
bun add @rikology/adonisjs-cloudinary
```

Then run the AdonisJS configure command:

```sh
node ace configure @rikology/adonisjs-cloudinary
```

This creates `config/cloudinary.ts` and registers the `CloudinaryProvider` in `adonisrc.ts`.

## Environment variables

Add these to your `.env` (values from the [Cloudinary console](https://cloudinary.com/console)):

| Variable                | Required | Description                |
| ----------------------- | -------- | -------------------------- |
| `CLOUDINARY_CLOUD_NAME` | Yes      | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY`    | Yes      | Your Cloudinary API key    |
| `CLOUDINARY_API_SECRET` | Yes      | Your Cloudinary API secret |

Register them in your env validator (`start/env.ts`):

```ts
import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  CLOUDINARY_CLOUD_NAME: Env.schema.string(),
  CLOUDINARY_API_KEY: Env.schema.string(),
  CLOUDINARY_API_SECRET: Env.schema.string(),
})
```

## Quick start

Inject the service and upload:

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

Render a transformed URL in Edge (the `cloudinaryUrl` global registers itself automatically):

```edge
<img
  src="{{ cloudinaryUrl('avatars/photo', { width: 200, height: 200, crop: 'fill' }) }}"
  alt="Avatar"
/>
```

## Service API (summary)

The `CloudinaryService` is bound to the container as `cloudinary`. Full reference: [Service API](./docs/service-api.md).

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

```ts
// Signed URL expiring in 1 hour
const url = cloudinary.signedUrl('private-doc', {
  expiresAt: Date.now() / 1000 + 3600,
})
```

For scripts and workers without the container:

```ts
import { createCloudinaryService, transformUrl } from '@rikology/adonisjs-cloudinary'

const cloudinary = createCloudinaryService({
  cloudName: 'demo',
  apiKey: '123456',
  apiSecret: 'secret',
})

const url = transformUrl('my-image', { cloudName: 'demo', apiKey: 'k', apiSecret: 's' }, { width: 200 })
```

See [Standalone Helpers](./docs/standalone-helpers.md).

## Drive bridge

An optional FlyDrive driver maps Drive operations onto Cloudinary API calls. It's imported from the `/drive` subpath so it never loads unless you use it:

```ts
import { CloudinaryDrive } from '@rikology/adonisjs-cloudinary/drive'
import { createCloudinaryService } from '@rikology/adonisjs-cloudinary'

const cloudinary = createCloudinaryService({
  cloudName: env.get('CLOUDINARY_CLOUD_NAME'),
  apiKey: env.get('CLOUDINARY_API_KEY'),
  apiSecret: env.get('CLOUDINARY_API_SECRET'),
})

const driveConfig = defineConfig({
  default: 'cloudinary',
  services: {
    cloudinary: () => new CloudinaryDrive(cloudinary),
  },
})
```

> Requires the optional `flydrive` (or `@adonisjs/drive`) peer dependency. Cloudinary is a media platform, not a byte-level object store — see the [Drive Bridge](./docs/drive-bridge.md) guide for supported/unsupported operations.

## Advanced

Need something the wrappers don't cover? The raw SDK is one property away:

```ts
const cloudinary = await app.container.make('cloudinary')

// Admin API
await cloudinary.sdk.api.resources({ type: 'upload', prefix: 'avatars/', max_results: 50 })

// Search API
await cloudinary.sdk.search
  .expression('resource_type:image AND tags=featured')
  .sort_by('created_at', 'desc')
  .max_results(30)
  .execute()

// Upload presets
await cloudinary.sdk.uploader.upload(file, { upload_preset: 'my-preset' })
```

See [Advanced](./docs/advanced.md) for Admin/Search API patterns, upload presets, multi-account strategies, and testing.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Contributions, issues, and feature requests are welcome.

## License

[MIT](./LICENSE.md) © Riko Riswandha Fahmi Prasetyo
