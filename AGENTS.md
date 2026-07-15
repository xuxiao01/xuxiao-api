# Repository Guidelines

## Project Structure & Module Organization

Application code lives in `src/`. `src/main.ts` starts the server, while `src/app.ts` configures Express and registers the business modules selected by `APP_MODULES`. Organize each product under `src/modules/<product>/`; current products are `weekly-lab/` and `crush-date/`. Register products in `src/modules/index.ts`. Shared middleware belongs in `src/middleware/`, reusable helpers in `src/utils/`, global configuration in `src/config/`, and infrastructure clients in `src/lib/`.

Prisma models and migrations live in `prisma/`. Do not edit generated files in `src/generated/` or build output in `dist/`. Keep API and design documentation under its product directory, such as `doc/weekly-lab/` or `doc/crush-date/`.

## Build, Test, and Development Commands

- `pnpm install` installs the locked dependencies.
- `pnpm dev` runs `src/main.ts` with `tsx` watch mode.
- `pnpm dev:crush-date` starts only the `crush-date` module.
- `pnpm dev:weekly` starts only the `weekly-lab` module.
- `pnpm build` type-checks and compiles TypeScript into `dist/`.
- `pnpm start` runs the compiled service.
- `pnpm prisma:generate` regenerates the Prisma client after schema changes.
- `pnpm prisma:migrate` creates and applies development migrations.
- `pnpm prisma:studio` opens the local database browser.

Copy `.env.example` to `.env` before local development and ensure PostgreSQL is running.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, single quotes, semicolons, and trailing commas in multiline constructs, matching existing code. Use `camelCase` for variables and functions, `PascalCase` for types, and kebab-case filenames such as `weekly-report.service.ts`. Keep HTTP concerns in routes/controllers, business logic in services, and request validation in Zod schema files. Prefer named exports except where the existing Express module pattern uses a default export.

## Testing Guidelines

No automated test framework or coverage threshold is configured yet. Before submitting changes, run `pnpm build` and manually exercise affected endpoints using that module's `doc/<module>/api.md`. If adding tests, introduce a documented `pnpm test` script and name files `*.test.ts`, colocated with the module or under `tests/`.

## Commit & Pull Request Guidelines

History follows Conventional Commits, including `feat:`, `feat(scope):`, and `docs:`. Use concise, imperative subjects, for example `feat(auth): validate refresh tokens`. Keep schema changes and their generated migration together. Pull requests should explain the behavior change, list verification commands, link relevant issues, and call out API, environment-variable, or migration impacts. Include request/response examples when an endpoint contract changes.

## Security & Configuration

Never commit `.env`, credentials, tokens, or production database URLs. Put global validation in `src/config/env.ts` and module-specific validation beside that module, such as `weekly-lab.config.ts`. Add only safe placeholders to `.env.example`.
