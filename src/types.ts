import type { ForgejoApiClient } from './api-client.js';
import type { components } from './generated/forgejo-api.js';

/** Forgejo API schemas, generated from the OpenAPI spec (see `npm run codegen`) */
type Schemas = components['schemas'];

/**
 * Commit object from semantic-release
 */
export interface Commit {
  hash: string;
  message: string;
  subject?: string;
  body?: string;
  author?: {
    name: string;
    email: string;
  };
}

/**
 * Release object from semantic-release
 */
export interface Release {
  name: string;
  url: string;
  type?: string;
  channel?: string;
}

/**
 * Branch configuration
 */
export interface Branch {
  name: string;
  prerelease?: boolean | string;
  channel?: string;
}

/**
 * Next release information
 */
export interface NextRelease {
  version: string;
  gitTag: string;
  gitHead: string;
  notes?: string;
  type?: string;
  channel?: string;
}

/**
 * Last release information
 */
export interface LastRelease {
  version?: string;
  gitTag?: string;
  gitHead?: string;
}

/**
 * Plugin configuration options
 */
export interface ForgejoPluginConfig {
  /** Forgejo server URL (defaults to git remote origin) */
  forgejoUrl?: string;

  /** API authentication token */
  forgejoToken?: string;

  /**
   * Assets to upload with release
   * Can be a string glob, array of globs, or asset objects
   */
  assets?: AssetConfig[] | string[] | string;

  /**
   * Template for success comments on issues/PRs
   * Uses Lodash template syntax. Set to false to disable.
   */
  successComment?: string | false;

  /**
   * Condition for posting success comments
   * Lodash template returning boolean
   */
  successCommentCondition?: string | false;

  /** Template for failure issue body */
  failComment?: string;

  /** Title for failure issue */
  failTitle?: string;

  /** Labels to apply to failure issue */
  labels?: string[];

  /** Assignees for failure issue */
  assignees?: string[];

  /** Labels to add to released issues/PRs. Set to false to disable. */
  releasedLabels?: string[] | false;

  /** Proxy URL for HTTP requests */
  proxy?: string;
}

/**
 * Asset configuration
 */
export interface AssetConfig {
  /** Glob pattern or file path */
  path: string;

  /** Optional: override filename for upload */
  name?: string;

  /** Optional: content type (auto-detected if omitted) */
  type?: string;

  /** Optional: asset label */
  label?: string;
}

/**
 * Resolved asset ready for upload
 */
export interface ResolvedAsset {
  /** Absolute file path */
  path: string;

  /** Filename for upload */
  name: string;

  /** MIME type */
  type: string;

  /** Optional label */
  label?: string;
}

/**
 * Resolved configuration with all values populated
 */
export interface ResolvedConfig {
  forgejoUrl: string;
  forgejoToken: string;
  assets: AssetConfig[];
  successComment: string | false;
  successCommentCondition: string | false;
  failComment: string;
  failTitle: string;
  labels: string[];
  assignees: string[];
  releasedLabels: string[] | false;
  proxy?: string;
  repositoryOwner: string;
  repositoryName: string;
}

/**
 * Forgejo API object shapes, aliased from the generated OpenAPI types.
 *
 * NOTE: every field on these schemas is optional — the Forgejo spec marks no
 * property as `required`, so consumers must guard fields that may be absent.
 */
export type ForgejoRelease = Schemas['Release'];
export type ForgejoUser = Schemas['User'];
/** Release assets are `Attachment` in the Forgejo/Gitea spec */
export type ForgejoAsset = Schemas['Attachment'];
export type ForgejoIssue = Schemas['Issue'];
export type ForgejoLabel = Schemas['Label'];
export type ForgejoComment = Schemas['Comment'];
export type ForgejoRepository = Schemas['Repository'];

/**
 * Repository information extracted from git remote
 */
export interface RepositoryInfo {
  owner: string;
  repo: string;
  url: string;
}

/**
 * Options for creating a release (aliased from the generated OpenAPI types)
 */
export type CreateReleaseOptions = Schemas['CreateReleaseOption'];

/**
 * Options for creating an issue (aliased from the generated OpenAPI types)
 */
export type CreateIssueOptions = Schemas['CreateIssueOption'];

/**
 * Plugin context from semantic-release with plugin state
 */
export interface PluginContext {
  /** Logger instance */
  logger: Logger;
  /** Current working directory */
  cwd: string;
  /** Environment variables */
  env?: NodeJS.ProcessEnv;
  /** Branch configuration */
  branch: Branch;
  /** Next release information */
  nextRelease?: NextRelease;
  /** Last release information */
  lastRelease?: LastRelease;
  /** Commits since last release */
  commits?: Commit[];
  /** Published releases */
  releases?: Release[];
  /** Errors from the release process */
  errors?: Error[];
  /** Resolved Forgejo configuration (set by verifyConditions) */
  forgejoConfig?: ResolvedConfig;
  /** Forgejo API client (set by verifyConditions) */
  forgejoClient?: ForgejoApiClient;
  /** Published Forgejo release (set by publish) */
  forgejoRelease?: ForgejoRelease;
}

/**
 * Publish result returned by the publish hook
 */
export interface PublishResult {
  name: string;
  url: string;
}

/**
 * Template context for Lodash templates
 */
export interface TemplateContext {
  branch: Branch;
  lastRelease: LastRelease;
  nextRelease: NextRelease;
  commits: Commit[];
  releases: Release[];
  issue?: ForgejoIssue;
  errors?: Error[];
}

/**
 * Logger interface from semantic-release
 */
export interface Logger {
  log: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}
