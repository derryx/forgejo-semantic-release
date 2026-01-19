import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveConfig, validateConfig } from '../src/resolve-config.js';

// Mock execSync to avoid git dependency
vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockImplementation(() => {
    throw new Error('git not available');
  }),
}));

describe('resolveConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('token resolution', () => {
    it('should use forgejoToken from plugin config', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          forgejoToken: 'config-token',
        },
        {},
        '/tmp'
      );
      expect(config.forgejoToken).toBe('config-token');
    });

    it('should use FORGEJO_TOKEN from environment', () => {
      const config = resolveConfig(
        { forgejoUrl: 'https://forgejo.example.com' },
        { FORGEJO_TOKEN: 'env-token' },
        '/tmp'
      );
      expect(config.forgejoToken).toBe('env-token');
    });

    it('should use GITEA_TOKEN as fallback', () => {
      const config = resolveConfig(
        { forgejoUrl: 'https://forgejo.example.com' },
        { GITEA_TOKEN: 'gitea-token' },
        '/tmp'
      );
      expect(config.forgejoToken).toBe('gitea-token');
    });

    it('should prefer FORGEJO_TOKEN over GITEA_TOKEN', () => {
      const config = resolveConfig(
        { forgejoUrl: 'https://forgejo.example.com' },
        { FORGEJO_TOKEN: 'forgejo-token', GITEA_TOKEN: 'gitea-token' },
        '/tmp'
      );
      expect(config.forgejoToken).toBe('forgejo-token');
    });

    it('should prefer config token over environment', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          forgejoToken: 'config-token',
        },
        { FORGEJO_TOKEN: 'env-token' },
        '/tmp'
      );
      expect(config.forgejoToken).toBe('config-token');
    });
  });

  describe('URL resolution', () => {
    it('should use forgejoUrl from plugin config', () => {
      const config = resolveConfig({ forgejoUrl: 'https://forgejo.example.com' }, {}, '/tmp');
      expect(config.forgejoUrl).toBe('https://forgejo.example.com');
    });

    it('should use FORGEJO_URL from environment', () => {
      const config = resolveConfig({}, { FORGEJO_URL: 'https://env.forgejo.com' }, '/tmp');
      expect(config.forgejoUrl).toBe('https://env.forgejo.com');
    });

    it('should use GITEA_URL as fallback', () => {
      const config = resolveConfig({}, { GITEA_URL: 'https://gitea.example.com' }, '/tmp');
      expect(config.forgejoUrl).toBe('https://gitea.example.com');
    });

    it('should strip trailing slash from URL', () => {
      const config = resolveConfig({ forgejoUrl: 'https://forgejo.example.com/' }, {}, '/tmp');
      expect(config.forgejoUrl).toBe('https://forgejo.example.com');
    });

    it('should strip multiple trailing slashes', () => {
      const config = resolveConfig({ forgejoUrl: 'https://forgejo.example.com///' }, {}, '/tmp');
      expect(config.forgejoUrl).toBe('https://forgejo.example.com');
    });
  });

  describe('assets normalization', () => {
    it('should handle undefined assets', () => {
      const config = resolveConfig({ forgejoUrl: 'https://forgejo.example.com' }, {}, '/tmp');
      expect(config.assets).toEqual([]);
    });

    it('should handle string asset', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          assets: 'dist/*.zip',
        },
        {},
        '/tmp'
      );
      expect(config.assets).toEqual([{ path: 'dist/*.zip' }]);
    });

    it('should handle array of string assets', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          assets: ['dist/*.zip', 'dist/*.tar.gz'],
        },
        {},
        '/tmp'
      );
      expect(config.assets).toEqual([{ path: 'dist/*.zip' }, { path: 'dist/*.tar.gz' }]);
    });

    it('should handle array of asset objects', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          assets: [
            { path: 'dist/app.zip', name: 'Application' },
            { path: 'dist/docs.zip', label: 'Documentation' },
          ],
        },
        {},
        '/tmp'
      );
      expect(config.assets).toEqual([
        { path: 'dist/app.zip', name: 'Application' },
        { path: 'dist/docs.zip', label: 'Documentation' },
      ]);
    });

    it('should handle mixed array of strings and objects', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          assets: ['dist/*.zip', { path: 'dist/app.exe', name: 'Windows App' }],
        },
        {},
        '/tmp'
      );
      expect(config.assets).toEqual([
        { path: 'dist/*.zip' },
        { path: 'dist/app.exe', name: 'Windows App' },
      ]);
    });
  });

  describe('success comment configuration', () => {
    it('should use default success comment', () => {
      const config = resolveConfig({ forgejoUrl: 'https://forgejo.example.com' }, {}, '/tmp');
      expect(config.successComment).toContain(':tada:');
    });

    it('should use custom success comment', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          successComment: 'Custom success message',
        },
        {},
        '/tmp'
      );
      expect(config.successComment).toBe('Custom success message');
    });

    it('should allow disabling success comments', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          successComment: false,
        },
        {},
        '/tmp'
      );
      expect(config.successComment).toBe(false);
    });
  });

  describe('fail configuration', () => {
    it('should use default fail title', () => {
      const config = resolveConfig({ forgejoUrl: 'https://forgejo.example.com' }, {}, '/tmp');
      expect(config.failTitle).toContain('automated release failed');
    });

    it('should use custom fail title', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          failTitle: 'Custom Failure Title',
        },
        {},
        '/tmp'
      );
      expect(config.failTitle).toBe('Custom Failure Title');
    });

    it('should use default fail comment', () => {
      const config = resolveConfig({ forgejoUrl: 'https://forgejo.example.com' }, {}, '/tmp');
      expect(config.failComment).toContain('Automated release failed');
    });

    it('should use custom fail comment', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          failComment: 'Custom failure message',
        },
        {},
        '/tmp'
      );
      expect(config.failComment).toBe('Custom failure message');
    });
  });

  describe('labels and assignees', () => {
    it('should use default labels', () => {
      const config = resolveConfig({ forgejoUrl: 'https://forgejo.example.com' }, {}, '/tmp');
      expect(config.labels).toEqual(['semantic-release']);
    });

    it('should use custom labels', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          labels: ['bug', 'release-failure'],
        },
        {},
        '/tmp'
      );
      expect(config.labels).toEqual(['bug', 'release-failure']);
    });

    it('should have empty assignees by default', () => {
      const config = resolveConfig({ forgejoUrl: 'https://forgejo.example.com' }, {}, '/tmp');
      expect(config.assignees).toEqual([]);
    });

    it('should use custom assignees', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          assignees: ['user1', 'user2'],
        },
        {},
        '/tmp'
      );
      expect(config.assignees).toEqual(['user1', 'user2']);
    });
  });

  describe('released labels', () => {
    it('should be false by default', () => {
      const config = resolveConfig({ forgejoUrl: 'https://forgejo.example.com' }, {}, '/tmp');
      expect(config.releasedLabels).toBe(false);
    });

    it('should use custom released labels', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          releasedLabels: ['released', 'shipped'],
        },
        {},
        '/tmp'
      );
      expect(config.releasedLabels).toEqual(['released', 'shipped']);
    });

    it('should allow explicitly disabling released labels', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          releasedLabels: false,
        },
        {},
        '/tmp'
      );
      expect(config.releasedLabels).toBe(false);
    });
  });

  describe('success comment condition', () => {
    it('should be false by default when not provided', () => {
      const config = resolveConfig({ forgejoUrl: 'https://forgejo.example.com' }, {}, '/tmp');
      expect(config.successCommentCondition).toBe(false);
    });

    it('should use custom success comment condition', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          successCommentCondition: "<%= issue.state === 'closed' %>",
        },
        {},
        '/tmp'
      );
      expect(config.successCommentCondition).toBe("<%= issue.state === 'closed' %>");
    });

    it('should allow explicitly disabling success comment condition with false', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          successCommentCondition: false,
        },
        {},
        '/tmp'
      );
      expect(config.successCommentCondition).toBe(false);
    });

    it('should NOT use empty string as condition (falsy but not false)', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          // @ts-expect-error - testing edge case
          successCommentCondition: '',
        },
        {},
        '/tmp'
      );
      // Empty string is falsy, so defaults to false
      expect(config.successCommentCondition).toBe(false);
    });
  });

  describe('proxy configuration', () => {
    it('should be undefined by default', () => {
      const config = resolveConfig({ forgejoUrl: 'https://forgejo.example.com' }, {}, '/tmp');
      expect(config.proxy).toBeUndefined();
    });

    it('should use proxy from config', () => {
      const config = resolveConfig(
        {
          forgejoUrl: 'https://forgejo.example.com',
          proxy: 'http://proxy.example.com:8080',
        },
        {},
        '/tmp'
      );
      expect(config.proxy).toBe('http://proxy.example.com:8080');
    });
  });
});

describe('validateConfig', () => {
  it('should throw ENOFORGEJOTOKEN when token is missing', () => {
    expect(() =>
      validateConfig({
        forgejoUrl: 'https://forgejo.example.com',
        forgejoToken: '',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        assets: [],
        successComment: '',
        successCommentCondition: false,
        failComment: '',
        failTitle: '',
        labels: [],
        assignees: [],
        releasedLabels: false,
      })
    ).toThrow('No Forgejo token specified');
  });

  it('should throw ENOFORGEJOURL when URL is missing', () => {
    expect(() =>
      validateConfig({
        forgejoUrl: '',
        forgejoToken: 'token',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        assets: [],
        successComment: '',
        successCommentCondition: false,
        failComment: '',
        failTitle: '',
        labels: [],
        assignees: [],
        releasedLabels: false,
      })
    ).toThrow(/URL/);
  });

  it('should throw EINVALIDGITURL when owner is missing', () => {
    expect(() =>
      validateConfig({
        forgejoUrl: 'https://forgejo.example.com',
        forgejoToken: 'token',
        repositoryOwner: '',
        repositoryName: 'repo',
        assets: [],
        successComment: '',
        successCommentCondition: false,
        failComment: '',
        failTitle: '',
        labels: [],
        assignees: [],
        releasedLabels: false,
      })
    ).toThrow(/Invalid git remote URL/);
  });

  it('should throw EINVALIDGITURL when repo is missing', () => {
    expect(() =>
      validateConfig({
        forgejoUrl: 'https://forgejo.example.com',
        forgejoToken: 'token',
        repositoryOwner: 'owner',
        repositoryName: '',
        assets: [],
        successComment: '',
        successCommentCondition: false,
        failComment: '',
        failTitle: '',
        labels: [],
        assignees: [],
        releasedLabels: false,
      })
    ).toThrow(/Invalid git remote URL/);
  });

  it('should not throw for valid config', () => {
    expect(() =>
      validateConfig({
        forgejoUrl: 'https://forgejo.example.com',
        forgejoToken: 'token',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        assets: [],
        successComment: '',
        successCommentCondition: false,
        failComment: '',
        failTitle: '',
        labels: [],
        assignees: [],
        releasedLabels: false,
      })
    ).not.toThrow();
  });
});
