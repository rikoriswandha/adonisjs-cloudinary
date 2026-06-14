# Standalone Helpers

For use cases outside the AdonisJS IoC container — scripts, queue workers, CLIs, serverless functions, or any plain Node project — the package exports two thin helpers that build a `CloudinaryService` directly from a config object.

```ts
import { createCloudinaryService, transformUrl } from '@rikology/adonisjs-cloudinary'
```

## `createCloudinaryService`

```ts
function createCloudinaryService(config: CloudinaryConfig): CloudinaryService
```

Creates a fully functional `CloudinaryService` from the camelCase [`CloudinaryConfig`](./configuration.md#cloudinaryconfig) shape. Internally it runs `defineConfig` (which validates required fields and maps to snake_case), then constructs the service.

```ts
import { createCloudinaryService } from '@rikology/adonisjs-cloudinary'

const cloudinary = createCloudinaryService({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
  apiKey: process.env.CLOUDINARY_API_KEY!,
  apiSecret: process.env.CLOUDINARY_API_SECRET!,
})

const result = await cloudinary.uploadImage('/tmp/upload.jpg', { folder: 'imports' })
```

The returned object is a real `CloudinaryService`, so every method documented in [Service API](./service-api.md) is available — `uploadImage`, `transformUrl`, `signedUrl`, `destroy`, `uploadStream`, and the `sdk` getter.

## `transformUrl`

```ts
function transformUrl(
  publicId: string,
  config: CloudinaryConfig,
  transformations?: TransformationOptions
): string
```

A one-shot URL generator for when you only need a transformed delivery URL and don't want to hold a service instance.

```ts
import { transformUrl } from '@rikology/adonisjs-cloudinary'

const url = transformUrl(
  'my-image',
  { cloudName: 'demo', apiKey: '123456', apiSecret: 'secret' },
  { width: 200, crop: 'thumb' }
)
// https://res.cloudinary.com/demo/image/upload/c_thumb,w_200/my-image
```

Each call constructs a fresh service internally and is fully **stateless** — safe to call repeatedly with the same or different configs.

## When to use which

| Situation | Use |
| --- | --- |
| AdonisJS controller / provider / middleware | `@inject()` / `container.make('cloudinary')` — see [Service API](./service-api.md) |
| A script or worker that uploads multiple assets | `createCloudinaryService` once, reuse the instance |
| A serverless function rendering a single URL | `transformUrl` one-shot |
| Non-AdonisJS Node project | `createCloudinaryService` |

## Singleton & shared-SDK caveat

The underlying `cloudinary` v2 SDK stores its configuration at the **module level**. Every `CloudinaryService` constructor (whether from the provider or `createCloudinaryService`) reconfigures that shared module via `cloudinary.config(...)`.

Practical implications:

- **Single account per process** is the clean, supported path. Create one service (or let the provider do it) and reuse it.
- **Multiple accounts in one process** is possible by calling `createCloudinaryService` before each operation, but because the SDK's config is module-global, you are effectively swapping the active config each time. This is safe for sequential use but **not** for concurrent operations that assume different accounts. For true multi-account concurrency, call the raw SDK explicitly with per-call config — see [Advanced: multiple cloud accounts](./advanced.md#multiple-cloud-accounts).

## Related

- [Configuration](./configuration.md) — `CloudinaryConfig` / `ConfigOptions` reference.
- [Service API](./service-api.md) — methods available on the returned service.
- [Advanced](./advanced.md) — raw SDK access and multi-account strategies.
