# TODO — Architectural Improvements

Findings from an architectural review, ranked by impact/effort. Each item notes its file
reference and rough effort. The plugin is in good shape overall; these are refinements.

Themes: (1) HTTP layer lacks production resilience, (2) correctness gaps in
issue-matching/pagination/idempotency, (3) fragile shared-state & config-resolution patterns,
(4) tooling/doc drift.

## P1 — Correctness & reliability (fix first)

- [ ] **Pagination claimed but absent** — `src/api-client.ts:201,231`. `findIssueByTitle` only
  inspects the first 100 open issues; the "pagination support" comment is aspirational. → failure
  issues aren't found, duplicates created, old ones never closed. _(medium)_
- [ ] **Fragile success-comment idempotency** — `src/success.ts:56`. "Already commented?" is a
  substring match on the version + the literal `'semantic-release'`. `1.2.0` matches `11.2.0`;
  customizing the template breaks dedup → duplicate comments. Use a hidden marker. _(low)_
- [ ] **No HTTP timeout** — every `fetch` in `src/api-client.ts`. A hung server hangs the release
  indefinitely. Add `AbortSignal.timeout(...)`. _(low)_
- [ ] **Templates fail open** — `src/utils/template.ts:17,36`. On error, `compileTemplate` returns
  the raw template (posts literal `${...}`) and `evaluateCondition` defaults to **true** (comments
  when it should suppress). Only `debug`, never `warn`. _(low)_

## P2 — Robustness (HTTP layer)

- [ ] **No retries / backoff / rate-limit handling** — `src/api-client.ts` `request`. A single
  transient 5xx / network blip / 429 aborts the whole release; `Retry-After` ignored. _(medium)_
- [ ] **`uploadAsset` buffers whole file in memory + hand-rolls multipart** —
  `src/api-client.ts:135-190`. Large binaries can exhaust memory. Use native `FormData`/`Blob`
  (or undici streaming). _(medium)_
- [ ] **API error bodies discarded** — `src/api-client.ts:66-75` (duplicated at `:177-184`). Only
  status + statusText captured; Forgejo's descriptive JSON error is thrown away. _(low)_
- [ ] **Validation runs only in `verify`; other hooks build unvalidated fallback clients** —
  `src/publish.ts:25`, `src/success.ts:179`, `src/fail.ts:34,42`. The `config || resolve` /
  `client || new` fallback silently builds an unverified client against `process.env`. _(low-medium)_
- [ ] **`proxy` config is a dead feature** — declared (`src/types.ts:101,152`), resolved
  (`src/resolve-config.ts:122`), never applied. Global `fetch` needs an undici dispatcher.
  Implement (undici `ProxyAgent`) or remove it and the docs. _(low)_

## P3 — Correctness (minor / edge cases)

- [ ] **Issue-reference regex is heuristic** — `src/success.ts:10-19`. Overlapping patterns,
  adjacency gaps in the standalone `#123` matcher, no issue-vs-PR semantics; can comment on
  unrelated issues. _(medium)_
- [ ] **`parse-git-url` assumptions** — `src/utils/parse-git-url.ts`. Always rebuilds `https://host`
  (drops custom ports, fails on path-prefixed/reverse-proxied instances); assumes remote is
  `origin`. _(low-medium)_
- [ ] **Inconsistent throw in `verify`** — `src/verify.ts:95`. Non-404 branch does a raw, uncoded
  `throw`, bypassing the `getError` + `AggregateError` convention. _(low)_
- [ ] **Misleading upload count** — `src/publish.ts:79`. Logs attempted, not succeeded, asset count.
  Track an `uploadedCount`. _(trivial)_
- [~] **Label IDs vs names** — `src/api-client.ts:311-321`, `src/fail.ts`. **Confirmed** by the
  generated types: the spec types `CreateIssueOption.labels` as `number[]` (label IDs), but the
  plugin sends names. The create-issue path now casts + documents this (`src/fail.ts`); resolving
  names → IDs at runtime is still outstanding. _(investigate)_

## P4 — Maintainability / architecture

- [ ] **`resolveConfig` shells out to git** — `src/resolve-config.ts:34-43`.
  `execSync('git remote get-url origin')` runs inside config resolution and re-runs in every hook
  fallback. semantic-release already supplies the repo URL via context. _(medium)_
- [ ] **`types.ts` is a god-module with a backwards dependency** — 351 lines mixing 4 concerns, and
  it imports `ForgejoApiClient` (`src/types.ts:1`) so the types module depends on an implementation
  module. Split + invert. _(medium)_
- [ ] **Duplicated fallback idiom in 3 hooks** — the `config || resolve` / `client || new` block
  encodes a fragile contract in triplicate. Extract one helper (contract, redaction,
  warn-on-fallback). _(low)_
- [ ] **Dead error definitions + inconsistent taxonomy** — `src/definitions/errors.ts:44-71`.
  `EINVALIDASSETS`, `ENOASSETFOUND`, `EASSETUPLOAD` are never used; asset failures throw raw HTTP
  errors instead. _(low)_
- [ ] **`ErrorCode` literal typing is defeated** — `src/definitions/errors.ts:6` annotates
  `Record<string, ErrorDefinition>`, widening `keyof typeof` to `string`, so a typo'd code compiles.
  Drop the annotation; let `as const` infer. _(trivial)_
- [ ] **Repeated code** — error-shaping block (`src/api-client.ts:66-75` == `:177-184`),
  MIME-fallback expression (`src/api-client.ts:143` == `src/glob-assets.ts:63`), tri-state ternary ×3
  (`src/resolve-config.ts:108-121`). _(low)_
- [~] **No runtime response validation; hand-maintained API types drift** — **Type drift: DONE.**
  `Forgejo*` types are now generated from the Forgejo OpenAPI spec (`npm run codegen`,
  `src/generated/forgejo-api.ts`, aliased in `src/types.ts`). **Runtime validation: still open** —
  responses are still cast via unchecked `<T>` in `src/api-client.ts:78`; a validator (e.g. zod) is
  the remaining piece. _(high)_
- [ ] **`process.env` used instead of injected `context.env`** — `src/verify.ts:23` and all
  fallbacks. Diverges from the framework-supplied environment. _(low)_
- [ ] **`context.forgejoRelease` is write-only dead state** — set at `src/publish.ts:57`, never read
  (`success` builds URLs from `context.releases`). Remove or consume. _(trivial)_
- [ ] **`fail` errors double-cast** — `src/fail.ts:54` casts `{message,details}[]`
  `as unknown as Error[]`. `TemplateContext.errors` should be a purpose-built shape. _(low)_

## P5 — Tooling / build / CI / docs

- [ ] **Build is ESM-only but CLAUDE.md claims CJS+ESM+types** — `package.json:18`
  (`tsdown --format esm`). CJS consumers can't `require()`. Add a CJS build or fix the docs. _(low)_
- [ ] **CI has no quality gates beyond pass/fail** — `.forgejo/workflows/ci.yaml`: no coverage gate
  (`test:coverage` never run), no mutation gate (Stryker not in CI, no `thresholds` in
  `stryker.config.json`), no standalone `tsc --noEmit` over tests. _(low-medium)_
- [ ] **ESLint disables all `no-unsafe-*` rules + `no-explicit-any` is only `warn`** —
  `eslint.config.mjs:66-71`, exactly where untyped JSON is handled. _(low)_
- [ ] **tsconfig strictness gaps** — no `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noUnused*`, `noImplicitOverride`; `skipLibCheck` on; tests excluded from the main tsconfig. _(low)_
- [ ] **No committed CHANGELOG** — `.releaserc.json` lacks `@semantic-release/changelog` + `git`;
  notes live only on the Forgejo release. _(low)_
- [ ] **Node-version inconsistency** — CI `node:24`, `engines >=22.14.0`, README says 20; no version
  matrix. _(trivial)_
- [ ] **npm caching commented out in CI** — `.forgejo/workflows/ci.yaml:121-127` → cold `npm ci`
  every run. _(trivial)_
- [ ] **Confirm intended TypeScript major** — recent revert of the TS 7.0 Renovate bump;
  `devDependencies.typescript` is `^6.0.0`. _(decision)_
