# Recipes

Copy-paste-ready patterns for common Cloudinary tasks in an AdonisJS v7 app. All examples assume the service is injected — see [Service API](./service-api.md) for the full method reference.

## Upload from a multipart form

```ts
import { inject } from '@adonisjs/core'
import type { CloudinaryService } from '@rikology/adonisjs-cloudinary'

@inject()
export default class ImagesController {
  constructor(protected cloudinary: CloudinaryService) {}

  async store({ request, response }) {
    const file = request.file('image', {
      size: '5mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp'],
    })

    if (!file.isValid) {
      return response.badRequest({ errors: file.errors })
    }

    const result = await this.cloudinary.uploadImage(file.tmpPath!, {
      folder: 'uploads',
      tags: ['user-upload'],
    })

    return response.created({ publicId: result.public_id, url: result.secure_url })
  }
}
```

## Avatar with on-upload transform

Generate a square crop at upload time and store the `public_id` against your user:

```ts
const result = await this.cloudinary.uploadImage(file.tmpPath!, {
  folder: 'avatars',
  public_id: `user-${auth.user!.id}`,
  overwrite: true,
  transformation: [{ width: 400, height: 400, crop: 'thumb', gravity: 'face', radius: 'max' }],
})

await auth.user!.merge({ avatarPublicId: result.public_id }).save()
```

Then render anywhere via Edge:

```edge
<img src="{{ cloudinaryUrl(user.avatarPublicId) }}" alt="{{ user.fullName }}" />
```

## Responsive `srcset`

Let the browser pick the right resolution — generate each variant as a URL transformation (no re-upload needed):

```ts
// In your controller / service
const variants = [400, 800, 1200].map((w) => ({
  width: w,
  url: this.cloudinary.transformUrl(product.imagePublicId, { width: w, crop: 'limit' }),
}))

return response.ok({ product, variants })
```

```edge
<img
  src="{{ variants[1].url }}"
  srcset="{{ variants.map((v) => `${v.url} ${v.width}w`).join(', ') }}"
  sizes="(max-width: 600px) 400px, 800px"
  alt="{{ product.name }}"
/>
```

## Gallery from the Search API

Skip a local DB mirror entirely and read straight from Cloudinary:

```ts
async index({ response }) {
  const results = await this.cloudinary.sdk.search
    .expression('resource_type:image AND tags=gallery')
    .sort_by('created_at', 'desc')
    .max_results(24)
    .execute()

  return response.ok({
    images: results.resources.map((r) => ({
      publicId: r.public_id,
      thumb: this.cloudinary.transformUrl(r.public_id, {
        width: 300,
        height: 300,
        crop: 'fill',
        gravity: 'auto',
      }),
    })),
  })
}
```

## Signed, expiring URL for private assets

```ts
// Valid for 15 minutes
const url = this.cloudinary.signedUrl('documents/invoice-2025', {
  expiresAt: new Date(Date.now() + 15 * 60 * 1000),
})

return response.ok({ url })
```

> Ensure the asset's access mode is **authenticated** in Cloudinary for the signature to actually gate access.

## Streaming upload (no disk buffering)

Pipe a readable stream straight to Cloudinary:

```ts
async store({ request, response }) {
  const stream = this.cloudinary.uploadStream({ folder: 'streams' })

  request.multipart.onFile('file', {}, (part) => {
    part.pipe(stream)
  })

  await request.multipart.process()

  // stream emits the upload result on 'finish'
  return response.ok({ ok: true })
}
```

For a simpler promise-based flow with a known readable, see [`uploadStream`](./service-api.md#uploadstream).

## Rename (move) an asset

```ts
await this.cloudinary.sdk.uploader.rename('temp/abc123', 'products/sneaker-main')
```

The original `public_id` no longer resolves after a rename.

## Delete with cleanup

```ts
// Single asset
await this.cloudinary.destroy(`avatars/user-${id}`)

// Everything under a folder prefix
await this.cloudinary.sdk.api.delete_resources_by_prefix('staging/')
```

## Bulk delete by tag

```ts
await this.cloudinary.sdk.api.delete_resources_by_tag('temp')
```

## Attach searchable metadata

Store structured metadata at upload, then query it via the Search API:

```ts
await this.cloudinary.uploadImage(file.tmpPath!, {
  folder: 'media',
  tags: ['library'],
  context: {
    'alt=en:Product photo on white background',
    'category=en:electronics',
  },
})

// Later
await this.cloudinary.sdk.search
  .expression('context.category:electronics')
  .sort_by('created_at', 'desc')
  .execute()
```

## Use Cloudinary as a FlyDrive disk

See the [Drive Bridge](./drive-bridge.md) guide. Short version:

```ts
import drive from '@adonisjs/core/services/drive'

const disk = drive.use('cloudinary')

await disk.put('avatars/user-42', Buffer.from(bytes), { contentType: 'image/png' })
const url = await disk.getUrl('avatars/user-42')
await disk.delete('avatars/user-42')
```

## Cleanup on model delete

Hook asset deletion into your Lucid model lifecycle so orphaned Cloudinary assets don't pile up:

```ts
import { BaseModel, column, beforeDelete } from '@adonisjs/lucid/orm'
import app from '@adonisjs/core/services/app'

export default class Image extends BaseModel {
  @column({ isPrimary: true }) declare id: number
  @column() declare publicId: string

  @beforeDelete()
  static async deleteFromCloudinary(image: Image) {
    const cloudinary = await app.container.make('cloudinary')
    await cloudinary.destroy(image.publicId)
  }
}
```

## Related

- [Service API](./service-api.md) — every method used above.
- [Advanced](./advanced.md) — Admin API, Search API, upload presets.
- [Edge Helpers](./edge-helpers.md) — `cloudinaryUrl` in templates.
