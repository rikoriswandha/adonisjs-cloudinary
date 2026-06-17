# Configuration

This document covers the generated config file, the `defineConfig` helper, the config types, and how the service is resolved from the IoC container.

## The config file

Running `node ace configure @rikology/adonisjs-cloudinary` generates `config/cloudinary.ts` from the following stub:

```ts
import env from '#start/env'
import { defineConfig } from '@rikology/adonisjs-cloudinary'

export default defineConfig({
  /**
   * Cloudinary cloud name.
   * Get yours from https://cloudinary.com/console
   */
  cloudName: env.get('CLOUDINARY_CLOUD_NAME'),

  /**
   * Cloudinary API key.
   */
  apiKey: env.get('CLOUDINARY_API_KEY'),

  /**
   * Cloudinary API secret.
   */
  apiSecret: env.get('CLOUDINARY_API_SECRET'),

  /**
   * Whether to use HTTPS URLs.
   */
  secure: true,
})
```

## `defineConfig`

```ts
function defineConfig(config: CloudinaryConfig): ConfigOptions
```

`defineConfig` does two things:

1. **Validates required fields.** It throws an `Error` if `cloudName`, `apiKey`, or `apiSecret` is missing or empty. The error message names the offending field, so a misconfigured env produces a clear failure at boot rather than a cryptic SDK error later.

2. **Maps camelCase to snake_case.** The Cloudinary v2 SDK expects `cloud_name`, `api_key`, `api_secret`. You write idiomatic camelCase; `defineConfig` translates.

| You write (`CloudinaryConfig`) | SDK receives (`ConfigOptions`) | Default |
| --- | --- | --- |
| `cloudName` | `cloud_name` | — (required) |
| `apiKey` | `api_key` | — (required) |
| `apiSecret` | `api_secret` | — (required) |
| `secure` | `secure` | `true` |

> `secure` defaults to `true` even when omitted. HTTPS delivery URLs are the safe default; set `secure: false` only if you have a specific reason (e.g. a localhost dev proxy that terminates TLS upstream).

### Validation errors

```ts
defineConfig({ cloudName: '', apiKey: 'key', apiSecret: 'secret' })
// Error: Cloudinary config is missing required field: cloudName
```

## Type reference

### `CloudinaryConfig`

The user-facing, camelCase configuration object you pass to `defineConfig`.

```ts
interface CloudinaryConfig {
  /** Cloudinary cloud name (e.g. "my-app"). */
  cloudName: string
  /** Cloudinary API key. */
  apiKey: string
  /** Cloudinary API secret. */
  apiSecret: string
  /** Whether to use HTTPS URLs. Defaults to true. */
  secure?: boolean
}
```

### `ConfigOptions`

The snake_case shape produced by `defineConfig` and consumed by the Cloudinary v2 SDK. You normally never write this by hand.

```ts
interface ConfigOptions {
  cloud_name: string
  api_key: string
  api_secret: string
  secure?: boolean
}
```

Both types are re-exported from the package root:

```ts
import type { CloudinaryConfig, ConfigOptions } from '@rikology/adonisjs-cloudinary'
```

## Container binding & type augmentation

The provider registers the service as a singleton under the key **`cloudinary`**, and also binds the **`CloudinaryService` class token** so constructors and the `@inject()` decorator can resolve the service idiomatically.

The package augments AdonisJS's `ContainerBindings` interface so the string token is fully typed:

```ts
declare module '@adonisjs/core/types' {
  export interface ContainerBindings {
    cloudinary: CloudinaryService
  }
}
```

This means `app.container.make('cloudinary')` resolves to a typed `CloudinaryService` with no manual casting.

```ts
import app from '@adonisjs/core/services/app'
import type { CloudinaryService } from '@rikology/adonisjs-cloudinary'

const cloudinary = await app.container.make('cloudinary') // CloudinaryService
```

For idiomatic injection, import `CloudinaryService` as a value and resolve or inject by class token:

```ts
import { CloudinaryService } from '@rikology/adonisjs-cloudinary'

const cloudinary = await app.container.make(CloudinaryService)
```

```ts
import { inject } from '@adonisjs/core'
import { CloudinaryService } from '@rikology/adonisjs-cloudinary'

@inject()
export default class UploadService {
  constructor(protected cloudinary: CloudinaryService) {}
}
```

Both the string token and the class token resolve to the same singleton instance.

## How config is loaded at runtime

`CloudinaryProvider.register()` reads the config from the AdonisJS config store:

```ts
this.app.container.singleton('cloudinary', async () => {
  const config = this.app.config.get<ConfigOptions>('cloudinary')
  return new CloudinaryService(config)
})

this.app.container.singleton(CloudinaryService, async () => {
  return this.app.container.make('cloudinary')
})
```

The singleton is lazily constructed — the `CloudinaryService` (and therefore the Cloudinary SDK's module-level config) is only initialized the first time something resolves `cloudinary` from the container.

> **Singleton note.** The underlying `cloudinary` v2 SDK holds module-level config. The provider binds a single singleton, so within one process there is one active Cloudinary config. If you need multiple cloud accounts in the same process, create separate `CloudinaryService` instances via [`createCloudinaryService`](./standalone-helpers.md) and be aware that each constructor call reconfigures the shared SDK module. See [Advanced: multiple cloud accounts](./advanced.md#multiple-cloud-accounts).

## Related

- [Service API](./service-api.md) — what you can do with the resolved service.
- [Getting Started](./getting-started.md) — install and first upload.
