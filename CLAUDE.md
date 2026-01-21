# CLAUDE.md

## Project Overview

forgejo-semantic-release is a semantic-release plugin for Forgejo/Gitea. It automates releases by creating releases, uploading assets, commenting on resolved issues/PRs, and creating failure issues.

## Commands

```bash
npm run build          # Build with tsdown (outputs CJS, ESM, types to dist/)
npm test               # Run tests
npm run test:coverage  # Run tests with coverage
npm run test:mutation  # Run mutation tests with Stryker
npm run lint           # Lint src/ and test/
npm run format         # Format with Prettier
```

## Architecture

**Plugin Hooks** (in execution order):
1. `verifyConditions` - Validates config, tests API auth, stores client in context
2. `publish` - Creates release, uploads assets, returns release URL
3. `success` - Comments on resolved issues, adds labels, closes failure issues
4. `fail` - Creates/updates failure issue with error details

**Key Files:**
- `src/types.ts` - All TypeScript interfaces
- `src/api-client.ts` - ForgejoApiClient wrapping fetch API
- `src/resolve-config.ts` - Configuration resolution and validation
- `src/glob-assets.ts` - Asset path globbing and MIME type detection
- `src/get-error.ts` - Semantic-release error creation helper
- `src/definitions/errors.ts` - Centralized error definitions
- `src/utils/parse-git-url.ts` - Git URL parsing (HTTPS, SSH variants)
- `src/utils/template.ts` - Lodash template compilation

## Code Conventions

- Use `import type` for type-only imports (ESLint enforced)
- Prefix unused variables with `_`
- Use native `fetch` API for HTTP requests
- Debug logging via `debug` module with namespace `forgejo-semantic-release:*`
- Templates use Lodash syntax with context: `branch`, `lastRelease`, `nextRelease`, `commits`, `releases`, `issue`, `errors`

## Testing

- Vitest with mocked HTTP via undici
- Test helpers in `test/helpers/`: `mock-context.ts`, `mock-forgejo.ts`
- `createMockContext()` provides mock logger and config
- `mockResponses` contains fixture data for API responses

## Environment Variables

- `FORGEJO_TOKEN` / `GITEA_TOKEN` - API authentication
- `FORGEJO_URL` / `GITEA_URL` - Server URL (auto-detected from git remote if not set)
