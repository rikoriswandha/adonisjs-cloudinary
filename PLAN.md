# AdonisJS Cloudinary Provider — Comprehensive Plan

## 1. Philosophy & Design Principles

- **Native SDK exposure**: Do not wrap or abstract Cloudinary's API. The provider makes the SDK injectable and configurable via AdonisJS's IoC container and config system.
- **Thin helpers**: Convenience methods for the 90% use cases (upload image/video, transform URL, signed URL). These delegate to the SDK, not replace it.
- **No impedance mismatch**: Cloudinary is fundamentally a media transformation API, not a file system. A Drive bridge is provided as a **separate optional module** for basic CRUD only.
- **AdonisJS v7 idioms**: Uses ServiceProvider, container singletons, config contracts, `@inject()`, and Edge globals.

## 2. Package Structure

```
.
├── package.json
├── index.ts                    # Public exports
├── configure.ts                # `node ace configure` hook
├── src/
│   ├── cloudinary_service.ts   # Main service class (injectable)
│   ├── cloudinary_config.ts    # Config schema/validator
│   ├── helpers.ts              # Standalone helper functions
│   ├── types.ts                # TypeScript interfaces & ContainerBindings
│   └── drive/
│       ├── cloudinary_drive.ts # Optional FlyDrive driver (DriverContract)
│       └── disk.ts             # Drive disk factory
├── providers/
│   └── cloudinary_provider.ts  # ServiceProvider: bindings + Edge globals
├── stubs/
│   ├── main.ts                 # stubsRoot export
│   └── config/cloudinary.stub  # Generated config file
├── tests/
│   ├── cloudinary_service.spec.ts
│   ├── helpers.spec.ts
│   └── edge_helper.spec.ts
└── README.md
```

## 3. Dependencies

```json
{
  "dependencies": {
    "cloudinary": "^2.x"
  },
  "peerDependencies": {
    "@adonisjs/core": "^7.0.0"
  },
  "devDependencies": {
    "@adonisjs/core": "^7.0.1",
    "@japa/runner": "^5.3.0",
    "@japa/assert": "^4.2.0",
    "typescript": "^5.9.3"
  }
}
```

## 4. Config Schema (`config/cloudinary.ts`)

```ts
import { defineConfig } from 'adonisjs-cloudinary'

export default defineConfig({
  cloudName: env.get('CLOUDINARY_CLOUD_NAME'),
  apiKey: env.get('CLOUDINARY_API_KEY'),
  apiSecret: env.get('CLOUDINARY_API_SECRET'),
  secure: true,
  privateCdn: false,
  cname: undefined,
  uploadPrefix: undefined,
  // Default upload options applied to all uploads unless overridden
  uploadPreset: undefined,
})
```

**Env variables:**

- `CLOUDINARY_CLOUD_NAME` — required
- `CLOUDINARY_API_KEY` — required
- `CLOUDINARY_API_SECRET` — required for signed uploads/URLs
- `CLOUDINARY_SECURE` — optional, default `true`
- `CLOUDINARY_PRIVATE_CDN` — optional

## 5. Cloudinary Service (`src/cloudinary_service.ts`)

```ts
import { v2 as cloudinary, ConfigOptions, UploadApiResponse } from 'cloudinary'

export class CloudinaryService {
  constructor(protected config: ConfigOptions) {
    cloudinary.config(config)
  }

  /** Direct access to the native Cloudinary SDK */
  get sdk() {
    return cloudinary
  }

  /** Upload an image with common defaults */
  async uploadImage(
    file: string | Buffer | ReadableStream,
    options?: {
      folder?: string
      publicId?: string
      tags?: string[]
      overwrite?: boolean
      [key: string]: unknown
    }
  ): Promise<UploadApiResponse> {
    return cloudinary.uploader.upload(file, {
      resource_type: 'image',
      ...options,
    })
  }

  /** Upload a video with common defaults */
  async uploadVideo(
    file: string | Buffer | ReadableStream,
    options?: {
      folder?: string
      publicId?: string
      tags?: string[]
      eager?: Array<{ transformation: string | object }>
      [key: string]: unknown
    }
  ): Promise<UploadApiResponse> {
    return cloudinary.uploader.upload(file, {
      resource_type: 'video',
      ...options,
    })
  }

  /** Upload a raw file */
  async uploadFile(
    file: string | Buffer | ReadableStream,
    options?: {
      folder?: string
      publicId?: string
      [key: string]: unknown
    }
  ): Promise<UploadApiResponse> {
    return cloudinary.uploader.upload(file, {
      resource_type: 'raw',
      ...options,
    })
  }

  /** Transform a public ID into a delivery URL */
  transformUrl(
    publicId: string,
    transformations?: Record<string, string | number | boolean>
  ): string {
    return cloudinary.url(publicId, transformations)
  }

  /** Generate a signed URL for private assets */
  signedUrl(
    publicId: string,
    options?: {
      expiresAt?: Date | number
      type?: string
      [key: string]: unknown
    }
  ): string {
    const config: Record<string, unknown> = { sign_url: true, ...options }

    if (options?.expiresAt) {
      const seconds =
        typeof options.expiresAt === 'number'
          ? options.expiresAt
          : Math.floor((options.expiresAt.getTime() - Date.now()) / 1000)
      config.url_suffix = seconds
    }

    return cloudinary.url(publicId, config)
  }

  /** Stream-based upload for multipart files */
  uploadStream(options?: {
    resourceType?: 'image' | 'video' | 'raw' | 'auto'
    [key: string]: unknown
  }) {
    return cloudinary.uploader.upload_stream({
      resource_type: options?.resourceType ?? 'auto',
      ...options,
    })
  }

  /** Destroy an asset by public ID */
  async destroy(publicId: string, options?: { resourceType?: string }): Promise<unknown> {
    return cloudinary.uploader.destroy(publicId, {
      resource_type: options?.resourceType ?? 'image',
    })
  }
}
```

## 6. IoC Container Binding (`providers/cloudinary_provider.ts`)

```ts
import type { ApplicationService } from '@adonisjs/core/types'
import edge from 'edge.js'
import { CloudinaryService } from '../src/cloudinary_service.js'

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    cloudinary: CloudinaryService
  }
}

export default class CloudinaryProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(CloudinaryService, () => {
      const config = this.app.config.get<ConfigOptions>('cloudinary')
      return new CloudinaryService(config)
    })
  }

  async boot() {
    const cloudinary = await this.app.container.make(CloudinaryService)

    edge.global(
      'cloudinaryUrl',
      (publicId: string, transformations?: Record<string, string | number | boolean>) => {
        return cloudinary.transformUrl(publicId, transformations)
      }
    )
  }
}
```

**Usage in controllers:**

```ts
import { inject } from '@adonisjs/core'
import { CloudinaryService } from 'adonisjs-cloudinary'

@inject()
export default class UploadsController {
  constructor(protected cloudinary: CloudinaryService) {}

  async store({ request }: HttpContext) {
    const result = await this.cloudinary.uploadImage(request.file('avatar')!.tmpPath!)
    return { publicId: result.public_id, url: result.secure_url }
  }
}
```

**Usage in Edge:**

```edge
<img src="{{ cloudinaryUrl('products/shoe.jpg', { width: 300, crop: 'fill' }) }}" />
```

## 7. Type Augmentation (`src/types.ts`)

```ts
import { CloudinaryService } from './cloudinary_service.js'

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    cloudinary: CloudinaryService
  }
}

export interface CloudinaryConfig {
  cloudName: string
  apiKey?: string
  apiSecret?: string
  secure?: boolean
  privateCdn?: boolean
  cname?: string
  uploadPrefix?: string
  uploadPreset?: string
}
```

## 8. Optional Drive Bridge (`src/drive/cloudinary_drive.ts`)

Cloudinary is not a traditional file system — it has no directories, no byte-level reads, and transformations are first-class. The Drive bridge is **opt-in** and limited to:

- `put` → upload (returns public_id as key)
- `delete` → destroy
- `getUrl` → transformUrl (no read)
- `getSignedUrl` → signedUrl
- `exists` → admin API search (rate-limited, use sparingly)

```ts
import type {
  DriverContract,
  ObjectMetaData,
  ObjectVisibility,
  SignedURLOptions,
  WriteOptions,
} from 'flydrive/types'
import { Readable } from 'node:stream'
import { CloudinaryService } from '../cloudinary_service.js'

export class CloudinaryDrive implements DriverContract {
  constructor(protected cloudinary: CloudinaryService) {}

  async exists(key: string): Promise<boolean> {
    // Uses search API; prefer not to rely on this in hot paths
    const result = await this.cloudinary.sdk.api.resources({
      type: 'upload',
      prefix: key,
      max_results: 1,
    })
    return result.resources.length > 0
  }

  async get(key: string): Promise<string> {
    throw new Error('Cloudinary does not support raw content retrieval. Use getUrl() instead.')
  }

  async getStream(key: string): Promise<Readable> {
    throw new Error('Cloudinary does not support raw content retrieval. Use getUrl() instead.')
  }

  async getBytes(key: string): Promise<Uint8Array> {
    throw new Error('Cloudinary does not support raw content retrieval. Use getUrl() instead.')
  }

  async getMetaData(key: string): Promise<ObjectMetaData> {
    const result = await this.cloudinary.sdk.api.resources({
      type: 'upload',
      prefix: key,
      max_results: 1,
    })
    const resource = result.resources[0]
    return {
      contentType: resource.resource_type,
      contentLength: resource.bytes,
      lastModified: new Date(resource.created_at),
      etag: undefined,
      httpEtag: undefined,
    }
  }

  async getVisibility(): Promise<ObjectVisibility> {
    return 'public'
  }

  async getUrl(key: string): Promise<string> {
    return this.cloudinary.transformUrl(key)
  }

  async getSignedUrl(key: string, options?: SignedURLOptions): Promise<string> {
    return this.cloudinary.signedUrl(key, {
      expiresAt: options?.expiresIn ? Date.now() + options.expiresIn * 1000 : undefined,
    })
  }

  async setVisibility(): Promise<void> {
    // NOOP — Cloudinary visibility is managed via access control, not per-file
  }

  async put(
    key: string,
    contents: string | Uint8Array,
    options?: WriteOptions
  ): Promise<void> {
    const buffer = typeof contents === 'string' ? Buffer.from(contents) : Buffer.from(contents)
    await this.cloudinary.sdk.uploader.upload(
      `data:text/plain;base64,${buffer.toString('base64')}`,
      { public_id: key, folder: options?.... }
    )
  }

  async putStream(key: string, contents: Readable, options?: WriteOptions): Promise<void> {
    await new Promise((resolve, reject) => {
      const stream = this.cloudinary.uploadStream({ public_id: key, ...options })
      contents.pipe(stream)
        .on('finish', resolve)
        .on('error', reject)
    })
  }

  async copy(): Promise<void> {
    throw new Error('Cloudinary does not support server-side copy.')
  }

  async move(source: string, destination: string): Promise<void> {
    await this.cloudinary.sdk.uploader.rename(source, destination)
  }

  async delete(key: string): Promise<void> {
    await this.cloudinary.destroy(key)
  }

  async deleteAll(prefix: string): Promise<void> {
    const result = await this.cloudinary.sdk.api.resources({
      type: 'upload',
      prefix,
      max_results: 500,
    })
    for (const resource of result.resources) {
      await this.cloudinary.destroy(resource.public_id)
    }
  }

  async listAll(prefix: string) {
    const result = await this.cloudinary.sdk.api.resources({
      type: 'upload',
      prefix,
      max_results: 500,
    })
    return {
      paginationToken: undefined,
      objects: result.resources.map((r) => new DriveFile(this, r.public_id)),
    }
  }
}
```

## 9. Configure Hook (`configure.ts`)

```ts
import type Configure from '@adonisjs/core/commands/configure'

export async function configure(command: Configure) {
  const codemods = await command.createCodemods()

  // Publish config stub
  await codemods.makeUsingStub(command.stubsRoot, 'config/cloudinary.stub', {})

  // Register provider in adonisrc.ts
  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('adonisjs-cloudinary/providers/cloudinary_provider')
  })
}
```

## 10. Tests

### Unit tests for helpers

```ts
import { test } from '@japa/runner'
import { CloudinaryService } from '../src/cloudinary_service.js'

test.group('CloudinaryService', () => {
  test('transformUrl generates delivery URL', ({ assert }) => {
    const service = new CloudinaryService({ cloud_name: 'demo', secure: true })
    const url = service.transformUrl('sample.jpg', { width: 100 })
    assert.include(url, 'res.cloudinary.com')
    assert.include(url, 'w_100')
  })

  test('signedUrl includes signature', ({ assert }) => {
    const service = new CloudinaryService({
      cloud_name: 'demo',
      api_key: 'key',
      api_secret: 'secret',
      secure: true,
    })
    const url = service.signedUrl('private.jpg', { type: 'authenticated' })
    assert.include(url, 's--')
  })
})
```

### Edge helper test

```ts
import { test } from '@japa/runner'
import edge from 'edge.js'

test.group('Edge helper', () => {
  test('cloudinaryUrl global renders transformed URL', ({ assert }) => {
    edge.global('cloudinaryUrl', (id, opts) => `https://demo.cloudinary.com/${id}?w=${opts?.width}`)
    const output = edge.renderRaw(`{{ cloudinaryUrl('test.jpg', { width: 200 }) }}`)
    assert.include(output, 'w=200')
  })
})
```

## 11. Implementation Order

1. **Scaffold** — Update `package.json` name/deps, create `src/types.ts`, `src/cloudinary_config.ts`
2. **Core Service** — Implement `src/cloudinary_service.ts` with native SDK exposure + helpers
3. **Provider** — Implement `providers/cloudinary_provider.ts` with IoC binding + Edge global
4. **Config & Stubs** — Create `stubs/config/cloudinary.stub`, wire `configure.ts`
5. **Drive Bridge** — Implement `src/drive/cloudinary_drive.ts` (optional, can ship later)
6. **Tests** — Unit tests for service, provider boot test, Edge helper test
7. **Docs** — README with installation, configuration, usage examples for all features

## 12. Key Decisions

| Decision                                         | Rationale                                                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `cloudinary.sdk` exposes native v2 SDK           | Users need full Cloudinary power; wrapping limits them                                                                  |
| `uploadImage/Video/File` are thin wrappers       | Sets sensible `resource_type` defaults; passes through all other options                                                |
| Drive bridge is separate/optional                | Cloudinary is a media API, not a disk. Forcing full DriveContract compliance would create a leaky abstraction           |
| `transformUrl` accepts `Record<string, unknown>` | Cloudinary transformation options are extensive and change frequently; strict typing would require constant maintenance |
| Edge helper registered in `boot()`               | Follows AdonisJS convention; depends on container being fully populated                                                 |
