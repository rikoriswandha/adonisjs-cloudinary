# Contributing to @rikology/adonisjs-cloudinary

Thanks for considering a contribution!

## Development setup

This project uses [Bun](https://bun.sh) for local development and CI, but any package manager that respects the `bun.lock` lockfile should work.

```sh
bun install
```

## Useful commands

| Command                 | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `npm run typecheck`     | Run TypeScript with `--noEmit`           |
| `npm run lint`          | Run ESLint                               |
| `npm run quick:test`    | Run the Japa test suite                  |
| `npm test`              | Run lint + tests with coverage           |
| `npm run build`         | Build the package into `build/`          |

Please make sure `npm run typecheck`, `npm run lint`, and `npm test` all pass before opening a pull request.

## Project conventions

- **Language**: TypeScript, ESM only (`"type": "module"`).
- **Style**: Prettier with `@adonisjs/prettier-config`. Run `npm run format` if needed.
- **Commits**: We use [Conventional Commits](https://www.conventionalcommits.org/). Examples:
  - `feat: add signed upload preset helper`
  - `fix(drive): handle stream errors in putStream`
  - `docs: clarify env variable registration`
- **Tests**: New features and bug fixes should include tests in the `tests/` directory. Mock the Cloudinary SDK with `sinon` rather than making real network calls.

## Opening a pull request

1. Fork the repository and create a branch from `main`.
2. Make your changes, add or update tests, and update documentation if needed.
3. Run the full verification stack: `npm run typecheck && npm run lint && npm test`.
4. Open a pull request with a clear description and a link to any related issue.

## Reporting issues

Use the [GitHub issue templates](https://github.com/rikoriswandha/adonisjs-cloudinary/issues/new/choose). For security concerns, please email the maintainer directly instead of opening a public issue.
