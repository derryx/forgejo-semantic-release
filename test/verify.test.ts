import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyConditions } from '../src/verify.js';
import { createMockContext, mockResponses } from './helpers/mock-context.js';
import { setupMockAgent, cleanupMock, getMockPool, apiPath } from './helpers/mock-forgejo.js';

// Mock child_process to control git remote URL
vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => 'https://forgejo.example.com/owner/repo.git\n'),
}));

describe('verifyConditions', () => {
  const baseUrl = 'https://forgejo.example.com';

  beforeEach(() => {
    setupMockAgent();
  });

  afterEach(() => {
    cleanupMock();
  });

  it('should verify valid token and repository access', async () => {
    const pool = getMockPool(baseUrl);
    pool.intercept({ path: apiPath('/user'), method: 'GET' }).reply(200, mockResponses.user);
    pool
      .intercept({ path: apiPath('/repos/owner/repo'), method: 'GET' })
      .reply(200, mockResponses.repository);

    const context = createMockContext();

    await verifyConditions(
      {
        forgejoUrl: 'https://forgejo.example.com',
        forgejoToken: 'test-token-123',
      },
      context
    );

    expect(context.forgejoConfig).toBeDefined();
    expect(context.forgejoClient).toBeDefined();
    expect(context.logger.log).toHaveBeenCalledWith('Authenticated as testuser');
  });

  it('should throw ENOFORGEJOTOKEN when token is missing', async () => {
    const originalForgejo = process.env.FORGEJO_TOKEN;
    const originalGitea = process.env.GITEA_TOKEN;
    delete process.env.FORGEJO_TOKEN;
    delete process.env.GITEA_TOKEN;

    try {
      const context = createMockContext();

      let thrownError: Error | undefined;
      try {
        await verifyConditions(
          {
            forgejoUrl: 'https://forgejo.example.com',
          },
          context
        );
      } catch (error) {
        thrownError = error as Error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError?.message).toContain('No Forgejo token specified');
    } finally {
      if (originalForgejo !== undefined) {
        process.env.FORGEJO_TOKEN = originalForgejo;
      }
      if (originalGitea !== undefined) {
        process.env.GITEA_TOKEN = originalGitea;
      }
    }
  });

  it('should throw EINVALIDFORGEJOTOKEN when authentication fails', async () => {
    const pool = getMockPool(baseUrl);
    pool
      .intercept({ path: apiPath('/user'), method: 'GET' })
      .reply(401, { message: 'Unauthorized' });

    const context = createMockContext();

    let thrownError: Error | undefined;
    try {
      await verifyConditions(
        {
          forgejoUrl: 'https://forgejo.example.com',
          forgejoToken: 'invalid-token',
        },
        context
      );
    } catch (error) {
      thrownError = error as Error;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError?.message).toContain('Invalid Forgejo token');
  });

  it('should throw ENOREPO when repository is not found', async () => {
    const pool = getMockPool(baseUrl);
    pool.intercept({ path: apiPath('/user'), method: 'GET' }).reply(200, mockResponses.user);
    pool
      .intercept({ path: apiPath('/repos/owner/repo'), method: 'GET' })
      .reply(404, { message: 'Not Found' });

    const context = createMockContext();

    let thrownError: Error | undefined;
    try {
      await verifyConditions(
        {
          forgejoUrl: 'https://forgejo.example.com',
          forgejoToken: 'test-token-123',
        },
        context
      );
    } catch (error) {
      thrownError = error as Error;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError?.message).toContain('Repository not found');
  });

  it('should throw ENOPUSHPERMISSION when user lacks push access', async () => {
    const repoWithoutPush = {
      ...mockResponses.repository,
      permissions: {
        admin: false,
        push: false,
        pull: true,
      },
    };

    const pool = getMockPool(baseUrl);
    pool.intercept({ path: apiPath('/user'), method: 'GET' }).reply(200, mockResponses.user);
    pool
      .intercept({ path: apiPath('/repos/owner/repo'), method: 'GET' })
      .reply(200, repoWithoutPush);

    const context = createMockContext();

    let thrownError: Error | undefined;
    try {
      await verifyConditions(
        {
          forgejoUrl: 'https://forgejo.example.com',
          forgejoToken: 'test-token-123',
        },
        context
      );
    } catch (error) {
      thrownError = error as Error;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError?.message).toContain('Insufficient repository permissions');
  });

  it('should use FORGEJO_TOKEN from environment', async () => {
    const originalEnv = process.env.FORGEJO_TOKEN;
    process.env.FORGEJO_TOKEN = 'env-token-123';

    try {
      const pool = getMockPool(baseUrl);
      pool.intercept({ path: apiPath('/user'), method: 'GET' }).reply(200, mockResponses.user);
      pool
        .intercept({ path: apiPath('/repos/owner/repo'), method: 'GET' })
        .reply(200, mockResponses.repository);

      const context = createMockContext();

      await verifyConditions(
        {
          forgejoUrl: 'https://forgejo.example.com',
        },
        context
      );

      expect(context.forgejoConfig).toBeDefined();
    } finally {
      if (originalEnv) {
        process.env.FORGEJO_TOKEN = originalEnv;
      } else {
        delete process.env.FORGEJO_TOKEN;
      }
    }
  });

  it('should use GITEA_TOKEN as fallback', async () => {
    const originalForgejo = process.env.FORGEJO_TOKEN;
    const originalGitea = process.env.GITEA_TOKEN;
    delete process.env.FORGEJO_TOKEN;
    process.env.GITEA_TOKEN = 'gitea-token-123';

    try {
      const pool = getMockPool(baseUrl);
      pool.intercept({ path: apiPath('/user'), method: 'GET' }).reply(200, mockResponses.user);
      pool
        .intercept({ path: apiPath('/repos/owner/repo'), method: 'GET' })
        .reply(200, mockResponses.repository);

      const context = createMockContext();

      await verifyConditions(
        {
          forgejoUrl: 'https://forgejo.example.com',
        },
        context
      );

      expect(context.forgejoConfig).toBeDefined();
    } finally {
      if (originalForgejo) {
        process.env.FORGEJO_TOKEN = originalForgejo;
      }
      if (originalGitea) {
        process.env.GITEA_TOKEN = originalGitea;
      } else {
        delete process.env.GITEA_TOKEN;
      }
    }
  });

  it('should store config and client in context for other hooks', async () => {
    const pool = getMockPool(baseUrl);
    pool.intercept({ path: apiPath('/user'), method: 'GET' }).reply(200, mockResponses.user);
    pool
      .intercept({ path: apiPath('/repos/owner/repo'), method: 'GET' })
      .reply(200, mockResponses.repository);

    const context = createMockContext();

    await verifyConditions(
      {
        forgejoUrl: 'https://forgejo.example.com',
        forgejoToken: 'test-token-123',
      },
      context
    );

    expect(context.forgejoConfig).toMatchObject({
      forgejoUrl: 'https://forgejo.example.com',
      forgejoToken: 'test-token-123',
      repositoryOwner: 'owner',
      repositoryName: 'repo',
    });
    expect(context.forgejoClient).toBeDefined();
  });

  it('should handle auth error with missing response object', async () => {
    const pool = getMockPool(baseUrl);
    // Simulate a network error without response object
    pool
      .intercept({ path: apiPath('/user'), method: 'GET' })
      .replyWithError(new Error('Network error'));

    const context = createMockContext();

    let thrownError: Error | undefined;
    try {
      await verifyConditions(
        {
          forgejoUrl: 'https://forgejo.example.com',
          forgejoToken: 'test-token-123',
        },
        context
      );
    } catch (error) {
      thrownError = error as Error;
    }

    expect(thrownError).toBeDefined();
    // Error should include fallback values (0 and 'Unknown error')
    expect(thrownError?.message).toContain('Invalid Forgejo token');
  });

  it('should re-throw non-404 errors when fetching repository', async () => {
    const pool = getMockPool(baseUrl);
    pool.intercept({ path: apiPath('/user'), method: 'GET' }).reply(200, mockResponses.user);
    pool
      .intercept({ path: apiPath('/repos/owner/repo'), method: 'GET' })
      .reply(500, { message: 'Internal Server Error' });

    const context = createMockContext();

    let thrownError: Error | undefined;
    try {
      await verifyConditions(
        {
          forgejoUrl: 'https://forgejo.example.com',
          forgejoToken: 'test-token-123',
        },
        context
      );
    } catch (error) {
      thrownError = error as Error;
    }

    expect(thrownError).toBeDefined();
    // Should be the raw HTTP error, not ENOREPO
    expect(thrownError?.message).toContain('500');
  });

  it('should verify repository and confirm push permission message', async () => {
    const pool = getMockPool(baseUrl);
    pool.intercept({ path: apiPath('/user'), method: 'GET' }).reply(200, mockResponses.user);
    pool
      .intercept({ path: apiPath('/repos/owner/repo'), method: 'GET' })
      .reply(200, mockResponses.repository);

    const context = createMockContext();

    await verifyConditions(
      {
        forgejoUrl: 'https://forgejo.example.com',
        forgejoToken: 'test-token-123',
      },
      context
    );

    expect(context.logger.log).toHaveBeenCalledWith('Repository owner/repo verified');
  });

  it('should log verifying message at start', async () => {
    const pool = getMockPool(baseUrl);
    pool.intercept({ path: apiPath('/user'), method: 'GET' }).reply(200, mockResponses.user);
    pool
      .intercept({ path: apiPath('/repos/owner/repo'), method: 'GET' })
      .reply(200, mockResponses.repository);

    const context = createMockContext();

    await verifyConditions(
      {
        forgejoUrl: 'https://forgejo.example.com',
        forgejoToken: 'test-token-123',
      },
      context
    );

    expect(context.logger.log).toHaveBeenCalledWith('Verifying Forgejo release conditions...');
  });
});
