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
 * Forgejo API Release object
 */
export interface ForgejoRelease {
  id: number;
  tag_name: string;
  target_commitish: string;
  name: string;
  body: string;
  url: string;
  html_url: string;
  tarball_url: string;
  zipball_url: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  author: ForgejoUser;
  assets: ForgejoAsset[];
}

/**
 * Forgejo API User object
 */
export interface ForgejoUser {
  id: number;
  login: string;
  full_name: string;
  email: string;
  avatar_url: string;
}

/**
 * Forgejo API Asset object
 */
export interface ForgejoAsset {
  id: number;
  name: string;
  size: number;
  download_count: number;
  created_at: string;
  uuid: string;
  browser_download_url: string;
}

/**
 * Forgejo API Issue object
 */
export interface ForgejoIssue {
  id: number;
  number: number;
  url: string;
  html_url: string;
  title: string;
  body: string;
  labels: ForgejoLabel[];
  state: 'open' | 'closed';
  pull_request?: {
    merged: boolean;
    merged_at: string | null;
  };
  user: ForgejoUser;
}

/**
 * Forgejo API Label object
 */
export interface ForgejoLabel {
  id: number;
  name: string;
  color: string;
  description: string;
}

/**
 * Forgejo API Comment object
 */
export interface ForgejoComment {
  id: number;
  html_url: string;
  body: string;
  user: ForgejoUser;
  created_at: string;
  updated_at: string;
}

/**
 * Forgejo API Repository object
 */
export interface ForgejoRepository {
  id: number;
  owner: ForgejoUser;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

/**
 * Repository information extracted from git remote
 */
export interface RepositoryInfo {
  owner: string;
  repo: string;
  url: string;
}

/**
 * Options for creating a release
 */
export interface CreateReleaseOptions {
  tag_name: string;
  target_commitish: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
}

/**
 * Options for creating an issue
 */
export interface CreateIssueOptions {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
}

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
  forgejoClient?: import('./api-client.js').ForgejoApiClient;
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
