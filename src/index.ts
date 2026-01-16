/**
 * semantic-release plugin for Forgejo
 *
 * This plugin provides integration with Forgejo (a fork of Gitea) for
 * automated releases via semantic-release.
 *
 * Features:
 * - Create releases on Forgejo with release notes
 * - Upload release assets (binaries, archives, etc.)
 * - Comment on resolved issues and PRs
 * - Create failure issues for release problems
 *
 * @packageDocumentation
 */

export { verifyConditions } from './verify.js';
export { publish } from './publish.js';
export { success } from './success.js';
export { fail } from './fail.js';

// Re-export types for consumers
export type { ForgejoPluginConfig, AssetConfig, ResolvedConfig, PublishResult } from './types.js';
