import { execSync } from 'node:child_process';
import type {
  ForgejoPluginConfig,
  ResolvedConfig,
  AssetConfig,
} from './types.js';
import { parseGitUrl } from './utils/parse-git-url.js';
import { getError } from './get-error.js';

const DEFAULT_SUCCESS_COMMENT = `
:tada: This \${issue.pull_request ? 'PR is included' : 'issue has been resolved'} in version \${nextRelease.version} :tada:

The release is available on [Forgejo](\${releases[0]?.url || 'the releases page'}).

Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:
`.trim();

const DEFAULT_FAIL_TITLE = 'The automated release failed :rotating_light:';

const DEFAULT_FAIL_COMMENT = `
## :rotating_light: Automated release failed

The automated release from branch \`\${branch.name}\` failed.

### Errors

\${errors.map(err => '- ' + err.message).join('\\n')}

---
*This issue was automatically created by semantic-release. Please fix the issues and push again.*
`.trim();

/**
 * Get the git remote URL for the repository
 */
function getGitRemoteUrl(cwd: string): string | null {
  try {
    const result = execSync('git remote get-url origin', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Normalize assets configuration to array of AssetConfig
 */
function normalizeAssets(
  assets: ForgejoPluginConfig['assets']
): AssetConfig[] {
  if (!assets) {
    return [];
  }

  if (typeof assets === 'string') {
    return [{ path: assets }];
  }

  if (Array.isArray(assets)) {
    return assets.map((asset) => {
      if (typeof asset === 'string') {
        return { path: asset };
      }
      return asset;
    });
  }

  return [];
}

/**
 * Resolve and validate plugin configuration
 */
export function resolveConfig(
  pluginConfig: ForgejoPluginConfig,
  env: NodeJS.ProcessEnv,
  cwd: string
): ResolvedConfig {
  // Resolve token from config or environment
  const forgejoToken =
    pluginConfig.forgejoToken ||
    env.FORGEJO_TOKEN ||
    env.GITEA_TOKEN ||
    '';

  // Resolve URL from config, environment, or git remote
  let forgejoUrl =
    pluginConfig.forgejoUrl || env.FORGEJO_URL || env.GITEA_URL || '';

  let repositoryOwner = '';
  let repositoryName = '';

  // If no URL provided, try to parse from git remote
  if (!forgejoUrl) {
    const remoteUrl = getGitRemoteUrl(cwd);
    if (remoteUrl) {
      const parsed = parseGitUrl(remoteUrl);
      if (parsed) {
        forgejoUrl = parsed.url;
        repositoryOwner = parsed.owner;
        repositoryName = parsed.repo;
      }
    }
  } else {
    // URL provided, still need owner/repo from git remote
    const remoteUrl = getGitRemoteUrl(cwd);
    if (remoteUrl) {
      const parsed = parseGitUrl(remoteUrl);
      if (parsed) {
        repositoryOwner = parsed.owner;
        repositoryName = parsed.repo;
      }
    }
  }

  // Remove trailing slash from URL
  forgejoUrl = forgejoUrl.replace(/\/+$/, '');

  return {
    forgejoUrl,
    forgejoToken,
    repositoryOwner,
    repositoryName,
    assets: normalizeAssets(pluginConfig.assets),
    successComment:
      pluginConfig.successComment === false
        ? false
        : pluginConfig.successComment || DEFAULT_SUCCESS_COMMENT,
    successCommentCondition:
      pluginConfig.successCommentCondition === false
        ? false
        : pluginConfig.successCommentCondition || false,
    failComment: pluginConfig.failComment || DEFAULT_FAIL_COMMENT,
    failTitle: pluginConfig.failTitle || DEFAULT_FAIL_TITLE,
    labels: pluginConfig.labels || ['semantic-release'],
    assignees: pluginConfig.assignees || [],
    releasedLabels:
      pluginConfig.releasedLabels === false
        ? false
        : pluginConfig.releasedLabels || false,
    proxy: pluginConfig.proxy,
  };
}

/**
 * Validate the resolved configuration
 */
export function validateConfig(config: ResolvedConfig): void {
  if (!config.forgejoToken) {
    throw getError('ENOFORGEJOTOKEN', { forgejoUrl: config.forgejoUrl });
  }

  if (!config.forgejoUrl) {
    throw getError('ENOFORGEJOURL');
  }

  if (!config.repositoryOwner || !config.repositoryName) {
    throw getError('EINVALIDGITURL', { url: 'unknown' });
  }
}
