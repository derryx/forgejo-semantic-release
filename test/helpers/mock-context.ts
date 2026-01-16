import type { PluginContext, ResolvedConfig } from '../../src/types.js';

/**
 * Create a mock logger for tests
 */
export function createMockLogger() {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

/**
 * Create a mock plugin context
 */
export function createMockContext(overrides: Partial<PluginContext> = {}): PluginContext {
  return {
    logger: createMockLogger(),
    cwd: process.cwd(),
    branch: {
      name: 'main',
      prerelease: false,
      channel: undefined,
    },
    nextRelease: {
      version: '1.0.0',
      gitTag: 'v1.0.0',
      gitHead: 'abc123def456',
      notes: '## Release Notes\n\n- Feature 1\n- Feature 2',
      type: 'minor',
      channel: undefined,
    },
    lastRelease: {
      version: '0.9.0',
      gitTag: 'v0.9.0',
      gitHead: '789xyz',
    },
    commits: [
      {
        hash: 'abc123def456',
        message: 'feat: add new feature\n\nfixes #123',
      },
    ],
    releases: [],
    errors: [],
    ...overrides,
  };
}

/**
 * Create a mock resolved config
 */
export function createMockConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    forgejoUrl: 'https://forgejo.example.com',
    forgejoToken: 'test-token-123',
    repositoryOwner: 'owner',
    repositoryName: 'repo',
    assets: [],
    successComment: ':tada: Released in ${nextRelease.version}',
    successCommentCondition: false,
    failComment: 'Release failed: ${errors.map(e => e.message).join(", ")}',
    failTitle: 'Automated release failed',
    labels: ['semantic-release'],
    assignees: [],
    releasedLabels: false,
    ...overrides,
  };
}

/**
 * Standard Forgejo API responses
 */
export const mockResponses = {
  user: {
    id: 1,
    login: 'testuser',
    full_name: 'Test User',
    email: 'test@example.com',
    avatar_url: 'https://forgejo.example.com/avatars/1',
  },

  repository: {
    id: 1,
    owner: {
      id: 1,
      login: 'owner',
      full_name: 'Owner',
      email: 'owner@example.com',
      avatar_url: 'https://forgejo.example.com/avatars/1',
    },
    name: 'repo',
    full_name: 'owner/repo',
    description: 'Test repository',
    html_url: 'https://forgejo.example.com/owner/repo',
    clone_url: 'https://forgejo.example.com/owner/repo.git',
    ssh_url: 'git@forgejo.example.com:owner/repo.git',
    permissions: {
      admin: true,
      push: true,
      pull: true,
    },
  },

  release: {
    id: 1,
    tag_name: 'v1.0.0',
    target_commitish: 'abc123def456',
    name: 'v1.0.0',
    body: '## Release Notes',
    url: 'https://forgejo.example.com/api/v1/repos/owner/repo/releases/1',
    html_url: 'https://forgejo.example.com/owner/repo/releases/tag/v1.0.0',
    tarball_url: 'https://forgejo.example.com/owner/repo/archive/v1.0.0.tar.gz',
    zipball_url: 'https://forgejo.example.com/owner/repo/archive/v1.0.0.zip',
    draft: false,
    prerelease: false,
    created_at: '2024-01-15T00:00:00Z',
    published_at: '2024-01-15T00:00:00Z',
    author: {
      id: 1,
      login: 'testuser',
      full_name: 'Test User',
      email: 'test@example.com',
      avatar_url: 'https://forgejo.example.com/avatars/1',
    },
    assets: [],
  },

  asset: {
    id: 1,
    name: 'release.zip',
    size: 1024,
    download_count: 0,
    created_at: '2024-01-15T00:00:00Z',
    uuid: 'abc-123-def',
    browser_download_url: 'https://forgejo.example.com/attachments/abc-123-def',
  },

  issue: {
    id: 1,
    number: 123,
    url: 'https://forgejo.example.com/api/v1/repos/owner/repo/issues/123',
    html_url: 'https://forgejo.example.com/owner/repo/issues/123',
    title: 'Test Issue',
    body: 'Issue body',
    labels: [],
    state: 'open' as const,
    user: {
      id: 1,
      login: 'testuser',
      full_name: 'Test User',
      email: 'test@example.com',
      avatar_url: 'https://forgejo.example.com/avatars/1',
    },
  },

  comment: {
    id: 1,
    html_url: 'https://forgejo.example.com/owner/repo/issues/123#issuecomment-1',
    body: 'Test comment',
    user: {
      id: 1,
      login: 'testuser',
      full_name: 'Test User',
      email: 'test@example.com',
      avatar_url: 'https://forgejo.example.com/avatars/1',
    },
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },

  failureIssue: {
    id: 999,
    number: 999,
    url: 'https://forgejo.example.com/api/v1/repos/owner/repo/issues/999',
    html_url: 'https://forgejo.example.com/owner/repo/issues/999',
    title: 'Automated release failed',
    body: 'Release failed: Test error',
    labels: [{ id: 1, name: 'semantic-release', color: 'red' }],
    state: 'open' as const,
    user: {
      id: 1,
      login: 'testuser',
      full_name: 'Test User',
      email: 'test@example.com',
      avatar_url: 'https://forgejo.example.com/avatars/1',
    },
  },
};
