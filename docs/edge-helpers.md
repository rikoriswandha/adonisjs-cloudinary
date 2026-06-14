# Edge Helpers

When [Edge.js](https://docs.adonisjs.com/guides/views-and-templates/introduction) is installed, the `CloudinaryProvider` automatically registers a `cloudinaryUrl` global so you can generate transformed delivery URLs directly in your templates.

## Registration

`CloudinaryProvider.boot()` performs a dynamic `import('edge.js')` and, on success, registers the global:

```ts
edge.global('cloudinaryUrl', (publicId, transformations) => {
  return cloudinary.transformUrl(publicId, transformations)
})
```

The global is a thin pass-through to [`CloudinaryService.transformUrl`](./service-api.md#transformurl). No extra setup is required — it happens during the provider boot lifecycle.

## Graceful absence

The dynamic import is wrapped in a `try/catch`. If `edge.js` is not installed (typical of API-only AdonisJS apps), the provider **skips** global registration silently and never throws. This means the package is safe to install in any AdonisJS app regardless of whether it renders views.

> If you're building an API-only app, you can ignore this section entirely — no template helper is registered, and nothing breaks.

## Usage

### Basic delivery URL

```edge
<img src="{{ cloudinaryUrl('avatars/photo') }}" alt="Avatar" />
```

### With transformations

Pass any [Cloudinary transformation options](https://cloudinary.com/documentation/transformation_reference) as the second argument:

```edge
<img
  src="{{ cloudinaryUrl('avatars/photo', { width: 200, height: 200, crop: 'fill' }) }}"
  alt="Avatar"
/>
```

renders:

```html
<img
  src="https://res.cloudinary.com/demo/image/upload/c_fill,h_200,w_200/avatars/photo"
  alt="Avatar"
/>
```

### Responsive `srcset`

```edge
<img
  src="{{ cloudinaryUrl('products/sneaker', { width: 400, crop: 'limit' }) }}"
  srcset="
    {{ cloudinaryUrl('products/sneaker', { width: 400, crop: 'limit' }) }} 400w,
    {{ cloudinaryUrl('products/sneaker', { width: 800, crop: 'limit' }) }} 800w,
    {{ cloudinaryUrl('products/sneaker', { width: 1200, crop: 'limit' }) }} 1200w
  "
  sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
  alt="Sneaker"
/>
```

### Looping a gallery

```edge
<div class="grid">
  @each(photo in photos)
    <img
      src="{{ cloudinaryUrl(photo.publicId, { width: 300, height: 300, crop: 'fill', gravity: 'face' }) }}"
      alt="{{ photo.title }}"
    />
  @end
</div>
```

## Notes

- The helper only **generates URLs** — it never makes a network call. It is safe to use in hot render paths.
- For signed/expiring URLs, resolve the service in your controller or use [`signedUrl`](./service-api.md#signedurl) directly; the Edge helper deliberately exposes only the unsigned `transformUrl` surface to keep templates side-effect-free.
- The global is attached to `edge.globals`, so it is available in every template, partial, and component without imports.

## Related

- [Service API](./service-api.md) — `transformUrl`, `signedUrl`, and upload methods.
- [Recipes](./recipes.md) — common upload + render patterns.
