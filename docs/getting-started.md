# Getting Started

Cloudinary integration for AdonisJS v7 — upload, transform, and deliver media through the Cloudinary v2 SDK, with first-class IoC container support, Edge templating helpers, and an optional FlyDrive bridge.

## Prerequisites

- **AdonisJS v7** application
- **Node.js >= 24** (matches the package `engines` constraint)
- A **Cloudinary account** — sign up free at [cloudinary.com](https://cloudinary.com). You will need your cloud name, API key, and API secret from the [console](https://cloudinary.com/console).

## 1. Install

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

## 2. Configure

Run the AdonisJS configure command:

```sh
node ace configure @rikology/adonisjs-cloudinary
```

This does two things:

1. **Creates `config/cloudinary.ts`** wired to your environment variables.
2. **Registers `CloudinaryProvider`** in `adonisrc.ts`.

## 3. Set environment variables

Add the following to your `.env` file (values from the [Cloudinary console](https://cloudinary.com/console)):

```sh
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

These must also be declared in your env validator. In a standard AdonisJS v7 app that is `start/env.ts`:

```ts
import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  CLOUDINARY_CLOUD_NAME: Env.schema.string(),
  CLOUDINARY_API_KEY: Env.schema.string(),
  CLOUDINARY_API_SECRET: Env.schema.string(),
})
```

## 4. Your first upload

Create a controller and inject the `CloudinaryService`:

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

## 5. Render in Edge

The provider registers a `cloudinaryUrl` global automatically when Edge is installed. Generate a transformed delivery URL directly in a template:

```edge
<img
  src="{{ cloudinaryUrl('avatars/photo', { width: 200, height: 200, crop: 'fill' }) }}"
  alt="Avatar"
/>
```

> The helper is not registered in API-only apps that don't use Edge — the provider handles this gracefully. See [Edge Helpers](./edge-helpers.md).

## Verify

Start your server and submit a multipart upload to the route mapped to `UploadsController.store`. A successful response looks like:

```json
{
  "url": "https://res.cloudinary.com/your-cloud-name/image/upload/c_fill,h_200,w_200/v1/avatars/photo.jpg",
  "publicId": "avatars/photo"
}
```

## Where to go next

| Topic | Document |
| --- | --- |
| Full config reference, validation, and type augmentation | [Configuration](./configuration.md) |
| Every `CloudinaryService` method, signatures, and return types | [Service API](./service-api.md) |
| Edge template usage and the `cloudinaryUrl` global | [Edge Helpers](./edge-helpers.md) |
| Using Cloudinary as a FlyDrive disk | [Drive Bridge](./drive-bridge.md) |
| Scripts, workers, and non-AdonisJS usage | [Standalone Helpers](./standalone-helpers.md) |
| Raw SDK access, Admin/Search API, upload presets | [Advanced](./advanced.md) |
| Avatars, galleries, signed URLs, and common patterns | [Recipes](./recipes.md) |
