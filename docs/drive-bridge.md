# Drive Bridge (FlyDrive)

`CloudinaryDrive` is an optional [FlyDrive](https://github.com/flydrive-js/drive) driver — re-exported by [`@adonisjs/drive`](https://docs.adonisjs.com/guides/digging-deeper/drive) — that wraps a `CloudinaryService` and maps FlyDrive disk operations onto Cloudinary API calls.

It lives behind the `/drive` subpath export so it never loads unless you import it:

```ts
import { CloudinaryDrive } from '@rikology/adonisjs-cloudinary/drive'
```

## Prerequisites

The driver depends on `flydrive` as an **optional** peer dependency. Install one of:

```sh
# If you use the AdonisJS Drive integration (recommended)
bun add @adonisjs/drive

# Or flydrive directly
bun add flydrive
```

The rest of the package works without this dependency.

## When to use it

Cloudinary is a **media delivery platform**, not a generic key/value object store. The bridge exists so you can slot Cloudinary into code that already speaks the FlyDrive `DriverContract` — not because Cloudinary is a drop-in replacement for S3.

Keep the [Supported](#supported-operations) and [Unsupported](#unsupported-operations) tables in mind: byte-level reads, copy, and per-file visibility are fundamentally outside Cloudinary's model.

## Setup

### With `@adonisjs/drive`

Register the driver in `config/drive.ts`. Build a `CloudinaryService` with `createCloudinaryService`, then pass it to `new CloudinaryDrive(...)`:

```ts
import env from '#start/env'
import { defineConfig } from '@adonisjs/drive'
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

export default driveConfig

declare module '@adonisjs/drive/types' {
  export interface DriveDisks extends InferDriveDisks<typeof driveConfig> {}
}
```

The `DriveDisks` augmentation gives you a fully typed `drive.use('cloudinary')`.

### Using the IoC container instead

If you'd rather reuse the singleton registered by the provider, resolve it from the container:

```ts
import app from '@adonisjs/core/services/app'
import { CloudinaryDrive } from '@rikology/adonisjs-cloudinary/drive'

const cloudinary = await app.container.make('cloudinary')
const drive = new CloudinaryDrive(cloudinary)
```

This is the right choice when `config/cloudinary.ts` is already your source of truth and you don't want a second, standalone `createCloudinaryService` call.

## Supported operations

| Method | Signature | Behavior |
| --- | --- | --- |
| `exists` | `(key): Promise<boolean>` | Searches the Admin API (`api.resources`) with a `prefix` match. **Rate-limited** — avoid in hot paths. |
| `getUrl` | `(key): Promise<string>` | Delegates to `CloudinaryService.transformUrl(key)`. Returns the unsigned delivery URL. |
| `getSignedUrl` | `(key, options?): Promise<string>` | Delegates to `CloudinaryService.signedUrl`, converting `options.expiresIn` (seconds) → `expiresAt` (Unix timestamp). |
| `put` | `(key, contents, options?): Promise<void>` | Base64-encodes `contents` and uploads as a `data:` URI with `public_id: key`. `options.contentType` defaults to `text/plain`. |
| `putStream` | `(key, contents, options?): Promise<void>` | Pipes the readable stream through `CloudinaryService.uploadStream({ public_id: key })`. Resolves on `finish`, rejects on `error`. |
| `move` | `(source, destination): Promise<void>` | Calls `cloudinary.uploader.rename(source, destination)` to rename a `public_id`. |
| `delete` | `(key): Promise<void>` | Delegates to `CloudinaryService.destroy(key)`. |
| `deleteAll` | `(prefix): Promise<void>` | Lists resources by `prefix` (max 500) and destroys each sequentially. |
| `listAll` | `(prefix): Promise<{ objects }>` | Lists resources by `prefix`, returning `DriveFile` instances. `paginationToken` is currently always `undefined`. |
| `getMetaData` | `(key): Promise<ObjectMetaData>` | Returns `{ contentType, contentLength, lastModified, etag }` from the Admin API. Throws if the asset does not exist. |
| `getVisibility` | `(key): Promise<'public'>` | Always returns `'public'` (Cloudinary assets are public by default). |

### Constructor

```ts
class CloudinaryDrive implements DriverContract {
  constructor(cloudinary: CloudinaryService)
}
```

The driver holds a reference to the injected service; all methods delegate to it.

## Unsupported operations

These methods exist on the driver for interface conformance but throw or no-op. The error messages explain why and suggest the alternative.

| Method | Reason | Alternative |
| --- | --- | --- |
| `get(key)` | Cloudinary is not a byte-level storage backend | Use `getUrl(key)` and fetch over HTTP, or download via the Admin API |
| `getStream(key)` | Same as above | Use `getUrl(key)` |
| `getBytes(key)` | Same as above | Use `getUrl(key)` |
| `copy(source, dest)` | Cloudinary has no server-side copy API | Upload the source again with a new `public_id`, or `move` if you don't need the original |
| `setVisibility(key, vis)` | Visibility is managed via Cloudinary access-control rules, not per-file | Configure access modes in Cloudinary; this method is a **no-op** |
| `getSignedUploadUrl(key)` | Not part of the standard Cloudinary upload flow | Use an [upload preset](https://cloudinary.com/documentation/upload_presets) or call `sdk.uploader` directly |

```ts
await drive.get('some/asset')
// Error: Cloudinary does not support raw content retrieval. Use getUrl() instead.
```

## Gotchas

- **`exists` and `getMetaData` hit the Admin API.** The Cloudinary Admin API has stricter rate limits than the Upload/Delivery APIs. Don't call these inside tight loops or per-request hot paths; cache results where possible.
- **`put` uses base64 data URIs.** Large files become large in-memory base64 strings. For big uploads prefer `putStream` or `CloudinaryService.uploadImage`/`uploadStream` with a file path.
- **`listAll` / `deleteAll` are capped at 500 results per call** (the Admin API `max_results` ceiling). For larger sets, paginate manually via the raw `sdk.api.resources()`.
- **`getMetaData.contentType` is the Cloudinary `resource_type`** (`image`/`video`/`raw`), not a MIME type — Cloudinary does not store arbitrary MIME types per asset.
- **`move` renames, it does not copy.** `uploader.rename` changes the `public_id`; the original no longer resolves.
- **`getSignedUrl` requires authenticated access mode** on the asset for the signature to actually gate access — see the note in [Service API: `signedUrl`](./service-api.md#signedurl).

## Minimal example

```ts
import drive from '@adonisjs/core/services/drive'

const disk = drive.use('cloudinary')

// Upload
await disk.put('avatars/user-42', Buffer.from(avatarBytes), {
  contentType: 'image/png',
})

// URL
const url = await disk.getUrl('avatars/user-42')

// Delete
await disk.delete('avatars/user-42')
```

## Related

- [Service API](./service-api.md) — the underlying methods the bridge delegates to.
- [Configuration](./configuration.md) — container binding and the singleton caveat.
