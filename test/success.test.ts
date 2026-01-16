import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ForgejoApiClient } from '../src/api-client.js';
import { success } from '../src/success.js';
import { createMockContext, createMockConfig, mockResponses } from './helpers/mock-context.js';
import { setupMockAgent, cleanupMock, getMockPool, apiPath } from './helpers/mock-forgejo.js';

describe('success', () => {
  const baseUrl = 'https://forgejo.example.com';

  beforeEach(() => {
    setupMockAgent();
  });

  afterEach(() => {
    cleanupMock();
  });

  it('should comment on issues referenced in commits', async () => {
    const pool = getMockPool(baseUrl);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123'),
        method: 'GET',
      })
      .reply(200, mockResponses.issue);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123/comments'),
        method: 'GET',
      })
      .reply(200, []);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123/comments'),
        method: 'POST',
      })
      .reply(201, mockResponses.comment);

    // No existing failure issue to close
    pool
      .intercept({
        path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
        method: 'GET',
      })
      .reply(200, []);

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      commits: [
        {
          hash: 'abc123',
          message: 'feat: add feature\n\nfixes #123',
        },
      ],
      releases: [
        {
          name: 'Forgejo release',
          url: 'https://forgejo.example.com/releases/v1.0.0',
        },
      ],
    });

    await success({}, context);

    expect(context.logger.log).toHaveBeenCalledWith('Commented on issue #123');
  });

  it('should skip commenting if successComment is false', async () => {
    const config = createMockConfig({
      successComment: false,
    });
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
    });

    await success({}, context);

    expect(context.logger.log).toHaveBeenCalledWith('Success comments are disabled, skipping...');
  });

  it('should skip if no issue references found', async () => {
    const pool = getMockPool(baseUrl);

    // Search for failure issues to close
    pool
      .intercept({
        path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
        method: 'GET',
      })
      .reply(200, []);

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      commits: [
        {
          hash: 'abc123',
          message: 'feat: add feature without issue reference',
        },
      ],
    });

    await success({}, context);

    expect(context.logger.log).toHaveBeenCalledWith('No issue references found in commits');
  });

  it('should skip if comment already exists', async () => {
    const pool = getMockPool(baseUrl);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123'),
        method: 'GET',
      })
      .reply(200, mockResponses.issue);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123/comments'),
        method: 'GET',
      })
      .reply(200, [
        {
          ...mockResponses.comment,
          body: ':tada: Released in 1.0.0 via semantic-release',
        },
      ]);

    pool
      .intercept({
        path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
        method: 'GET',
      })
      .reply(200, []);

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      commits: [
        {
          hash: 'abc123',
          message: 'fix: bug fix\n\ncloses #123',
        },
      ],
    });

    await success({}, context);

    // Should not post a new comment
    expect(context.logger.log).not.toHaveBeenCalledWith('Commented on issue #123');
  });

  it('should close existing failure issues', async () => {
    const pool = getMockPool(baseUrl);

    const failureIssue = {
      ...mockResponses.issue,
      number: 456,
      title: 'Automated release failed',
    };

    pool
      .intercept({
        path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
        method: 'GET',
      })
      .reply(200, [failureIssue]);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/456'),
        method: 'PATCH',
      })
      .reply(200, { ...failureIssue, state: 'closed' });

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      commits: [],
    });

    await success({}, context);

    expect(context.logger.log).toHaveBeenCalledWith('Closed failure issue #456');
  });

  it('should extract multiple issue patterns', async () => {
    const pool = getMockPool(baseUrl);

    // Mock for issue #1 (fixes pattern)
    pool
      .intercept({ path: apiPath('/repos/owner/repo/issues/1'), method: 'GET' })
      .reply(200, { ...mockResponses.issue, number: 1 });

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/1/comments'),
        method: 'GET',
      })
      .reply(200, []);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/1/comments'),
        method: 'POST',
      })
      .reply(201, mockResponses.comment);

    // Mock for issue #2 (closes pattern)
    pool
      .intercept({ path: apiPath('/repos/owner/repo/issues/2'), method: 'GET' })
      .reply(200, { ...mockResponses.issue, number: 2 });

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/2/comments'),
        method: 'GET',
      })
      .reply(200, []);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/2/comments'),
        method: 'POST',
      })
      .reply(201, mockResponses.comment);

    // Search for failure issues
    pool
      .intercept({
        path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
        method: 'GET',
      })
      .reply(200, []);

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      commits: [
        {
          hash: 'abc123',
          message: 'feat: feature\n\nfixes #1',
        },
        {
          hash: 'def456',
          message: 'fix: bug\n\ncloses #2',
        },
      ],
      releases: [
        {
          name: 'Forgejo release',
          url: 'https://forgejo.example.com/releases/v1.0.0',
        },
      ],
    });

    await success({}, context);

    expect(context.logger.log).toHaveBeenCalledWith('Found 2 referenced issue(s)/PR(s)');
  });

  it('should continue if issue fetch fails', async () => {
    const pool = getMockPool(baseUrl);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/999'),
        method: 'GET',
      })
      .reply(404, { message: 'Not Found' });

    pool
      .intercept({
        path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
        method: 'GET',
      })
      .reply(200, []);

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      commits: [
        {
          hash: 'abc123',
          message: 'feat: feature\n\nfixes #999',
        },
      ],
    });

    await success({}, context);

    // Should not throw and should not post any comments (issue fetch failed silently)
    expect(context.logger.log).not.toHaveBeenCalledWith(
      expect.stringContaining('Commented on issue')
    );
  });

  it('should add labels if releasedLabels is configured', async () => {
    const pool = getMockPool(baseUrl);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123'),
        method: 'GET',
      })
      .reply(200, mockResponses.issue);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123/comments'),
        method: 'GET',
      })
      .reply(200, []);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123/comments'),
        method: 'POST',
      })
      .reply(201, mockResponses.comment);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123/labels'),
        method: 'POST',
      })
      .reply(200, mockResponses.issue);

    pool
      .intercept({
        path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
        method: 'GET',
      })
      .reply(200, []);

    const config = createMockConfig({
      releasedLabels: ['released', 'v1.0.0'],
    });
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      commits: [
        {
          hash: 'abc123',
          message: 'feat: feature\n\nfixes #123',
        },
      ],
      releases: [
        {
          name: 'Forgejo release',
          url: 'https://forgejo.example.com/releases/v1.0.0',
        },
      ],
    });

    await success({}, context);

    // Verify comment was posted (labels are added after commenting)
    expect(context.logger.log).toHaveBeenCalledWith('Commented on issue #123');
  });
});
