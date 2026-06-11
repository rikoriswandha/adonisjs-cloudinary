# AdonisJS Cloudinary Provider — Implementation Plan

## Current State Snapshot

The repository is a fresh `pkg-starter-kit` with the following:
- `package.json`: starter configuration, no Cloudinary dependency
- `index.ts`: exports only `configure` and `stubsRoot`
- `configure.ts`: empty hook body
- `stubs/main.ts`: exports `stubsRoot` correctly
- `src/`, `providers/`: contain only README placeholders
- `tests/`: contains a single `example.spec.ts` stub
- No Cloudinary SDK, no Drive bridge, no Edge integration

## Implementation Phases

---

### Phase 1: Package Foundation & Dependencies

**Goal**: Reconfigure `package.json` and install dependencies to support the provider.

| Task | File(s) | Notes |
|------|---------|-------|
| Rename package | `package.json` | Change `name` from `pkg-starter-kit` to `adonisjs-cloudinary` |
| Add runtime dependency | `package.json` | Add `cloudinary: ^2.x` to `dependencies` |
| Add `cloudinary` type export | `package.json` | Ensure `./types` export resolves; may need to add `./cloudinary` or `./drive` subpath exports later |
| Update keywords | `package.json` | Add `adonisjs`, `cloudinary`, `media`, `upload` |
| Install dependencies | — | Run `bun install` (per context, always use `bun`) |
| Verify `tsconfig.json` | `tsconfig.json` | Ensure `moduleResolution` is `bundler` or `node` for AdonisJS v7 compat |

**Acceptance**: `bun install` completes, `cloudinary` appears in `node_modules`, `bun run typecheck` passes on existing code.

---

### Phase 2: Types & Config Schema

**Goal**: Define the TypeScript contract and configuration validator.

| Task | File(s) | Notes |
|------|---------|-------|
| Define `CloudinaryConfig` interface | `src/types.ts` | camelCase fields (`cloudName`, `apiKey`, etc.) as specified in PLAN §7 |
| Define `ConfigOptions` mapping | `src/types.ts` | Include a helper type or function that maps camelCase config to Cloudinary SDK's snake_case (`cloud_name`, `api_secret`, etc.) |
| Create config validator | `src/cloudinary_config.ts` | Use VineJS (AdonisJS v7 standard) or a plain `defineConfig` function that validates required fields at runtime |
| Export `defineConfig` | `src/cloudinary_config.ts` | Signature: `defineConfig(config: CloudinaryConfig): ConfigOptions` — returns snake_case object ready for the SDK |
| Add ContainerBindings augmentation | `src/types.ts` | `declare module '@adonisjs/core/types' { interface ContainerBindings { cloudinary: CloudinaryService } }` |
| Update `index.ts` | `index.ts` | Export `CloudinaryConfig`, `defineConfig`, and `CloudinaryService` |

**Config mapping rationale**: The PLAN exposes camelCase to users (`cloudName`) but the Cloudinary v2 SDK expects snake_case (`cloud_name`). The `defineConfig` function is the single point where this mapping happens.

**Acceptance**: `bun run typecheck` passes; `defineConfig({ cloudName: 'demo' })` returns `{ cloud_name: 'demo' }`.

---

### Phase 3: Core Service (`src/cloudinary_service.ts`)

**Goal**: Implement the injectable service class that wraps the Cloudinary SDK.

| Task | Notes |
|------|-------|
| Import `v2 as cloudinary` from `cloudinary` | Use the native SDK directly |
| Constructor accepts `ConfigOptions` (snake_case) | Call `cloudinary.config(config)` once |
| Implement `get sdk()` | Returns the raw `cloudinary` object for power users |
| Implement `uploadImage(file, options?)` | Sets `resource_type: 'image'`, spreads options |
| Implement `uploadVideo(file, options?)` | Sets `resource_type: 'video'`, spreads options |
| Implement `uploadFile(file, options?)` | Sets `resource_type: 'raw'`, spreads options |
| Implement `transformUrl(publicId, transformations?)` | Delegates to `cloudinary.url()` |
| Implement `signedUrl(publicId, options?)` | Sets `sign_url: true`, handles `expiresAt` → `url_suffix` conversion |
| Implement `uploadStream(options?)` | Returns `cloudinary.uploader.upload_stream()` |
| Implement `destroy(publicId, options?)` | Calls `cloudinary.uploader.destroy()`, defaults `resource_type` to `image` |

**Critical detail — `expiresAt` handling**: The PLAN sets `config.url_suffix = seconds` when `expiresAt` is provided. **Verify this against Cloudinary v2 SDK docs** — the canonical way to generate signed URLs in Cloudinary v2 is usually passing `sign_url: true` and an `expires_at` timestamp (Unix epoch seconds), not `url_suffix`. Implement what the SDK actually expects; the PLAN may have a pseudocode approximation.

**Acceptance**: Service class compiles; all public methods have correct TypeScript signatures.

---

### Phase 4: Service Provider & IoC Binding

**Goal**: Wire the service into AdonisJS's IoC container and register Edge globals.

| Task | File(s) | Notes |
|------|---------|-------|
| Create provider class | `providers/cloudinary_provider.ts` | `export default class CloudinaryProvider` with `register()` and `boot()` |
| Register singleton | `register()` | Bind `CloudinaryService` to the container; read `config.get('cloudinary')` from app config |
| Register Edge global | `boot()` | `edge.global('cloudinaryUrl', ...)` calling `cloudinary.transformUrl()` |
| Handle Edge absence gracefully | `boot()` | If `edge` is not configured in the host app, skip global registration (or catch import error) |
| Import types augmentation | `providers/cloudinary_provider.ts` | Import `../src/types.js` so the `ContainerBindings` merge is active |

**Edge global detail**: The PLAN imports `edge from 'edge.js'` directly. In AdonisJS v7, Edge is typically accessed via `await import('edge.js')` or through the app's view system. Use the pattern that matches `@adonisjs/core` v7 — likely `import edge from 'edge.js'` is correct if the app has it installed, but wrap in a try/catch so the provider works in API-only apps without Edge.

**Acceptance**: Provider compiles; `CloudinaryService` is resolvable from a mocked container in tests.

---

### Phase 5: Configure Hook & Stubs

**Goal**: Make `node ace configure adonisjs-cloudinary` generate the config file and register the provider.

| Task | File(s) | Notes |
|------|---------|-------|
| Create config stub | `stubs/config/cloudinary.stub` | Edge template generating `config/cloudinary.ts` with env vars and `defineConfig()` call |
| Implement `configure()` | `configure.ts` | Use `codemods.makeUsingStub()` to publish config; use `codemods.updateRcFile()` to add provider path |
| Verify stub path | `stubs/main.ts` | Already exports `stubsRoot` — ensure `command.stubsRoot` resolves correctly |
| Add env docs to stub | `stubs/config/cloudinary.stub` | Include `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` comments |

**Config stub content**:
```ts
import env from '#start/env'
import { defineConfig } from 'adonisjs-cloudinary'

export default defineConfig({
  cloudName: env.get('CLOUDINARY_CLOUD_NAME'),
  apiKey: env.get('CLOUDINARY_API_KEY'),
  apiSecret: env.get('CLOUDINARY_API_SECRET'),
  secure: true,
})
```

**Acceptance**: A test codemod can run `configure()` against a temp directory and verify `adonisrc.ts` contains the provider string and `config/cloudinary.ts` exists.

---

### Phase 6: Optional Drive Bridge

**Goal**: Implement `src/drive/cloudinary_drive.ts` as an opt-in FlyDrive driver.

| Task | Notes |
|------|-------|
| Import FlyDrive types | `flydrive/types` — confirm exact package name in AdonisJS v7 (likely `@adonisjs/drive` or `flydrive`) |
| Implement `exists(key)` | Use `cloudinary.sdk.api.resources()` with prefix search; limited to 1 result |
| Implement `get`, `getStream`, `getBytes` | Throw descriptive errors — Cloudinary is not a byte-level storage |
| Implement `getMetaData(key)` | Return `contentType`, `contentLength`, `lastModified` from API resource |
| Implement `getUrl(key)` | Delegate to `cloudinary.transformUrl(key)` |
| Implement `getSignedUrl(key, options?)` | Delegate to `cloudinary.signedUrl()` with `expiresIn` → `expiresAt` math |
| Implement `put(key, contents, options?)` | Convert contents to base64 data URI; use `public_id: key` |
| Implement `putStream(key, contents, options?)` | Pipe through `cloudinary.uploadStream()` |
| Implement `move(source, destination)` | Use `cloudinary.sdk.uploader.rename()` |
| Implement `delete(key)` | Delegate to `cloudinary.destroy()` |
| Implement `deleteAll(prefix)` | List up to 500 resources, delete each by `public_id` |
| Implement `listAll(prefix)` | Return mapped `DriveFile` objects |
| Implement `copy()` | Throw — unsupported by Cloudinary |
| Implement `setVisibility()` | NOOP — visibility is access-control based |

**Drive package dependency**: Add `@adonisjs/drive` (or `flydrive` if that's the v7 package) as an **optional peer dependency** so the Drive bridge only loads when the host app uses Drive.

**Acceptance**: Drive class compiles; type-checks against `DriverContract`.

---

### Phase 7: Standalone Helpers (`src/helpers.ts`)

**Goal**: Provide non-class helper functions for use cases where DI is unnecessary.

| Task | Notes |
|------|-------|
| Export `createCloudinaryService(config)` | Factory that instantiates `CloudinaryService` directly |
| Export `transformUrl(publicId, config, transformations?)` | One-shot URL generation without service instantiation |

These are thin convenience wrappers. Keep them minimal to avoid duplicating the service API surface.

---

### Phase 8: Test Suite

**Goal**: Cover service logic, provider boot, and Edge helper with Japa.

| Test File | Coverage |
|-----------|----------|
| `tests/cloudinary_service.spec.ts` | `transformUrl` generates correct delivery URLs; `signedUrl` includes signature; `uploadImage/Video/File` pass correct `resource_type` (mock SDK); `destroy` passes correct defaults |
| `tests/helpers.spec.ts` | `createCloudinaryService` returns configured instance; `transformUrl` helper works standalone |
| `tests/edge_helper.spec.ts` | `cloudinaryUrl` global is registered and renders transformed URLs; global is not registered when Edge is absent |
| `tests/configure.spec.ts` (new) | `configure()` publishes config stub and updates `adonisrc.ts` |
| `tests/drive_bridge.spec.ts` (new) | Drive methods delegate correctly; unsupported methods throw |

**Testing strategy**:
- Mock the Cloudinary SDK using `sinon` or `jest-style` module mocks to avoid real network calls.
- For `transformUrl` and `signedUrl`, assert on URL structure (domain, query params, signature prefix) rather than exact strings, since Cloudinary's URL generation may vary by SDK version.
- For provider tests, create a minimal AdonisJS application mock with a container and config.

**Acceptance**: `bun run quick:test` passes with all tests green.

---

### Phase 9: Documentation

**Goal**: Update `README.md` to explain installation, configuration, and usage.

| Section | Content |
|---------|---------|
| Installation | `bun add adonisjs-cloudinary`, `node ace configure adonisjs-cloudinary` |
| Env variables | Table of `CLOUDINARY_*` vars with required/optional flags |
| Usage (DI) | `@inject()` controller example with `uploadImage` |
| Usage (Edge) | `cloudinaryUrl()` global example with transformations |
| Advanced (SDK) | `cloudinary.sdk.api.resources()` etc. for power users |
| Drive Bridge | How to register the driver in `config/drive.ts` |
| API Reference | Brief list of service methods |

**Acceptance**: README is complete enough for a new user to install, configure, upload an image, and render a transformed URL in Edge.

---

### Phase 10: Build, Lint, and Publish Prep

| Task | Notes |
|------|-------|
| Run `bun run lint` | Fix any ESLint violations |
| Run `bun run typecheck` | Zero TypeScript errors |
| Run `bun run test` | Full suite with coverage |
| Verify `files` array | `package.json` `files` should include `build` and stubs |
| Verify exports | `index.ts` exports everything consumers need |
| Verify `bin/test.ts` | Ensure test setup imports `@japa/runner` correctly |

**Acceptance**: `bun run build` produces a valid `build/` directory with `.js`, `.d.ts`, and `.stub` files.

---

## Open Questions / Risks

1. **Cloudinary v2 SDK `expiresAt` API**: PLAN uses `url_suffix` for signed URL expiry. Cloudinary's v2 SDK may expect `expires_at` (Unix timestamp). Must verify actual SDK signature before implementing `signedUrl`.
2. **FlyDrive package name in AdonisJS v7**: Confirm whether the Drive bridge should import from `@adonisjs/drive`, `flydrive`, or another package. The PLAN references `flydrive/types` — verify this is correct for the AdonisJS version targeted.
3. **Edge global registration in API-only apps**: The provider should not crash if `edge.js` is not installed. Use a dynamic import with a fallback.
4. **`uploadStream` return type**: Cloudinary's `upload_stream` returns a stream; the service method should have a precise return type (likely `UploadStream` or `Transform`).

## File Checklist

```
☐ package.json          — renamed, deps added, exports updated
☐ index.ts              — public API exports
☐ configure.ts          — codemods hook
☐ src/types.ts          — ContainerBindings + CloudinaryConfig
☐ src/cloudinary_config.ts — defineConfig + validator
☐ src/cloudinary_service.ts — core service
☐ src/helpers.ts        — standalone helpers
☐ src/drive/
  ☐ cloudinary_drive.ts — FlyDrive driver
  ☐ disk.ts             — disk factory (if needed)
☐ providers/cloudinary_provider.ts — IoC + Edge
☐ stubs/config/cloudinary.stub — generated config
☐ tests/
  ☐ cloudinary_service.spec.ts
  ☐ helpers.spec.ts
  ☐ edge_helper.spec.ts
  ☐ configure.spec.ts
  ☐ drive_bridge.spec.ts
☐ README.md             — full docs
```
