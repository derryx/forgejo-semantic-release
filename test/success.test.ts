import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { success } from '../src';
import { ForgejoApiClient } from '../src/api-client.js';
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

  it('should skip issue when successCommentCondition evaluates to false', async () => {
    const pool = getMockPool(baseUrl);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123'),
        method: 'GET',
      })
      .reply(200, { ...mockResponses.issue, state: 'open' });

    pool
      .intercept({
        path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
        method: 'GET',
      })
      .reply(200, []);

    const config = createMockConfig({
      // Condition that evaluates to false - only comment on closed issues
      successCommentCondition: "<%= issue.state === 'closed' %>",
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

    // Should not comment because condition is false
    expect(context.logger.log).not.toHaveBeenCalledWith('Commented on issue #123');
  });

  it('should continue gracefully when adding labels fails', async () => {
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

    // Labels endpoint fails
    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123/labels'),
        method: 'POST',
      })
      .reply(500, { message: 'Internal Server Error' });

    pool
      .intercept({
        path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
        method: 'GET',
      })
      .reply(200, []);

    const config = createMockConfig({
      releasedLabels: ['released'],
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

    // Should not throw, label failure is handled gracefully
    await success({}, context);

    // Comment should still be posted even if labels fail
    expect(context.logger.log).toHaveBeenCalledWith('Commented on issue #123');
  });

  it('should handle error when checking for existing comments fails', async () => {
    const pool = getMockPool(baseUrl);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123'),
        method: 'GET',
      })
      .reply(200, mockResponses.issue);

    // Comments endpoint fails
    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123/comments'),
        method: 'GET',
      })
      .reply(500, { message: 'Internal Server Error' });

    // Comment is still posted (hasExistingReleaseComment returns false on error)
    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123/comments'),
        method: 'POST',
      })
      .reply(201, mockResponses.comment);

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

    // Comment should be posted (error checking existing comments returns false)
    expect(context.logger.log).toHaveBeenCalledWith('Commented on issue #123');
  });

  it('should warn when issue processing throws an unexpected error', async () => {
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

    // Comment creation fails with an unexpected error
    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123/comments'),
        method: 'POST',
      })
      .reply(500, { message: 'Internal Server Error' });

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

    // Should not throw, errors are caught and logged
    await success({}, context);

    // Should warn about the failure
    expect(context.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to process issue #123')
    );
  });

  it('should post comment when existing comment has only version but not semantic-release', async () => {
    const pool = getMockPool(baseUrl);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123'),
        method: 'GET',
      })
      .reply(200, mockResponses.issue);

    // Comment has version but not "semantic-release" text
    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123/comments'),
        method: 'GET',
      })
      .reply(200, [
        {
          ...mockResponses.comment,
          body: 'This mentions version 1.0.0 but is just a regular comment',
        },
      ]);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123/comments'),
        method: 'POST',
      })
      .reply(201, mockResponses.comment);

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

    // Should post a comment since existing comment doesn't have BOTH version AND semantic-release
    expect(context.logger.log).toHaveBeenCalledWith('Commented on issue #123');
  });

  it('should post comment when existing comment has semantic-release but not version', async () => {
    const pool = getMockPool(baseUrl);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123'),
        method: 'GET',
      })
      .reply(200, mockResponses.issue);

    // Comment has "semantic-release" but not the specific version
    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123/comments'),
        method: 'GET',
      })
      .reply(200, [
        {
          ...mockResponses.comment,
          body: 'Released via semantic-release in 0.9.0',
        },
      ]);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123/comments'),
        method: 'POST',
      })
      .reply(201, mockResponses.comment);

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

    // Should post a comment since existing comment has different version
    expect(context.logger.log).toHaveBeenCalledWith('Commented on issue #123');
  });

  it('should return false from processIssue when getIssue fails', async () => {
    const pool = getMockPool(baseUrl);

    // Issue fetch fails with 404
    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123'),
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

    // Should not log "Commented on issue" or "Posted X success comment(s)"
    expect(context.logger.log).not.toHaveBeenCalledWith('Commented on issue #123');
    expect(context.logger.log).not.toHaveBeenCalledWith(expect.stringContaining('Posted'));
  });

  it('should respect successCommentCondition returning false and not post comment', async () => {
    const pool = getMockPool(baseUrl);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123'),
        method: 'GET',
      })
      .reply(200, { ...mockResponses.issue, state: 'open' });

    // Search for failure issues
    pool
      .intercept({
        path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
        method: 'GET',
      })
      .reply(200, []);

    const config = createMockConfig({
      // Condition evaluates to false - only comment on issues with 'bug' label
      successCommentCondition: "<%= issue.labels && issue.labels.some(l => l.name === 'bug') %>",
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

    // Should not comment because condition is false (issue has no 'bug' label)
    expect(context.logger.log).not.toHaveBeenCalledWith('Commented on issue #123');
  });

  it('should skip labels when releasedLabels is false', async () => {
    const pool = getMockPool(baseUrl);
    let labelsEndpointCalled = false;

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

    // This should NOT be called
    pool
      .intercept({
        path: (path) => {
          if (path === apiPath('/repos/owner/repo/issues/123/labels')) {
            labelsEndpointCalled = true;
          }
          return path === apiPath('/repos/owner/repo/issues/123/labels');
        },
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
      releasedLabels: false, // Explicitly disabled
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

    expect(context.logger.log).toHaveBeenCalledWith('Commented on issue #123');
    expect(labelsEndpointCalled).toBe(false);
  });

  it('should skip labels when releasedLabels is empty array', async () => {
    const pool = getMockPool(baseUrl);
    let labelsEndpointCalled = false;

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

    // This should NOT be called
    pool
      .intercept({
        path: (path) => {
          if (path === apiPath('/repos/owner/repo/issues/123/labels')) {
            labelsEndpointCalled = true;
          }
          return path === apiPath('/repos/owner/repo/issues/123/labels');
        },
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
      releasedLabels: [], // Empty array
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

    expect(context.logger.log).toHaveBeenCalledWith('Commented on issue #123');
    expect(labelsEndpointCalled).toBe(false);
  });

  it('should process issue when successCommentCondition is not false', async () => {
    const pool = getMockPool(baseUrl);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123'),
        method: 'GET',
      })
      .reply(200, { ...mockResponses.issue, state: 'closed' });

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
        path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
        method: 'GET',
      })
      .reply(200, []);

    const config = createMockConfig({
      // Condition that evaluates to true - comment on closed issues
      successCommentCondition: "<%= issue.state === 'closed' %>",
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

    // Should comment because condition is true
    expect(context.logger.log).toHaveBeenCalledWith('Commented on issue #123');
  });

  it('should log posted comments count when comments were made', async () => {
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

    expect(context.logger.log).toHaveBeenCalledWith('Posted 1 success comment(s)');
  });

  it('should NOT log posted comments count when no comments were made', async () => {
    const pool = getMockPool(baseUrl);

    // Issue fetch fails - no comment will be posted
    pool
      .intercept({
        path: apiPath('/repos/owner/repo/issues/123'),
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

    // Should NOT log "Posted X success comment(s)" since commentedCount is 0
    expect(context.logger.log).not.toHaveBeenCalledWith(
      expect.stringMatching(/Posted \d+ success comment/)
    );
  });
});
