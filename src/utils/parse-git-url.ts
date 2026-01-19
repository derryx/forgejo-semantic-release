import type { RepositoryInfo } from '../types.js';

/**
 * Parse a git remote URL to extract owner, repo, and server URL
 *
 * Supports:
 * - HTTPS: https://forgejo.example.com/owner/repo.git
 * - SSH: git@forgejo.example.com:owner/repo.git
 * - SSH with protocol: ssh://git@forgejo.example.com/owner/repo.git
 */
export function parseGitUrl(remoteUrl: string): RepositoryInfo | null {
  if (!remoteUrl) {
    return null;
  }

  // Remove trailing .git if present
  const cleanUrl = remoteUrl.replace(/\.git\/?$/, '');

  // Try HTTPS format: https://host/owner/repo
  const httpsMatch = /^https?:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(cleanUrl);
  if (httpsMatch) {
    const [, host, owner, repo] = httpsMatch;
    return {
      url: `https://${host}`,
      owner,
      repo,
    };
  }

  // Try SSH format: git@host:owner/repo
  const sshMatch = /^git@([^:]+):([^/]+)\/([^/]+)$/.exec(cleanUrl);
  if (sshMatch) {
    const [, host, owner, repo] = sshMatch;
    return {
      url: `https://${host}`,
      owner,
      repo,
    };
  }

  // Try SSH with protocol: ssh://git@host/owner/repo or ssh://git@host:port/owner/repo
  const sshProtocolMatch = /^ssh:\/\/git@([^:/]+)(?::\d+)?\/([^/]+)\/([^/]+)$/.exec(cleanUrl);
  if (sshProtocolMatch) {
    const [, host, owner, repo] = sshProtocolMatch;
    return {
      url: `https://${host}`,
      owner,
      repo,
    };
  }

  return null;
}
