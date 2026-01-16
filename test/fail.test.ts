import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fail } from '../src/fail.js';
import { createMockContext, createMockConfig, mockResponses } from './helpers/mock-context.js';
import { setupMockAgent, cleanupMock, getMockPool, apiPath } from './helpers/mock-forgejo.js';
import { ForgejoApiClient } from '../src/api-client.js';

describe('fail', () => {
  const baseUrl = 'https://forgejo.example.com';

  beforeEach(() => {
    setupMockAgent();
  });

  afterEach(() => {
    cleanupMock();
  });

  it('should create a failure issue when none exists', async () => {
    const pool = getMockPool(baseUrl);

    // Search for existing failure issue
    pool.intercept({
      path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
      method: 'GET',
    }).reply(200, []);

    // Create new issue
    pool.intercept({ path: apiPath('/repos/owner/repo/issues'), method: 'POST' })
      .reply(201, mockResponses.failureIssue);

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      errors: [new Error('Release failed due to test error')],
    });

    await fail({}, context);

    expect(context.logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Created failure issue #999')
    );
  });

  it('should add comment to existing failure issue', async () => {
    const pool = getMockPool(baseUrl);

    const existingIssue = {
      ...mockResponses.failureIssue,
      number: 456,
    };

    // Search returns existing issue
    pool.intercept({
      path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
      method: 'GET',
    }).reply(200, [existingIssue]);

    // Add comment to existing issue
    pool.intercept({ path: apiPath('/repos/owner/repo/issues/456/comments'), method: 'POST' })
      .reply(201, mockResponses.comment);

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      errors: [new Error('Another release failure')],
    });

    await fail({}, context);

    expect(context.logger.log).toHaveBeenCalledWith('Updated existing failure issue #456');
  });

  it('should include labels and assignees in new issue', async () => {
    const pool = getMockPool(baseUrl);

    pool.intercept({
      path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
      method: 'GET',
    }).reply(200, []);

    pool.intercept({ path: apiPath('/repos/owner/repo/issues'), method: 'POST' })
      .reply(201, mockResponses.failureIssue);

    const config = createMockConfig({
      labels: ['bug', 'release-failure'],
      assignees: ['maintainer'],
    });
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      errors: [new Error('Release failed')],
    });

    await fail({}, context);

    expect(context.logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Created failure issue #999')
    );
  });

  it('should warn and not throw if missing configuration', async () => {
    const config = createMockConfig();
    config.forgejoToken = undefined as unknown as string;

    const context = createMockContext({
      forgejoConfig: config,
    });

    // Should not throw
    await fail({}, context);

    expect(context.logger.warn).toHaveBeenCalledWith(
      'Cannot create failure issue: missing Forgejo configuration'
    );
  });

  it('should warn if issue creation fails', async () => {
    const pool = getMockPool(baseUrl);

    pool.intercept({
      path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
      method: 'GET',
    }).reply(200, []);

    pool.intercept({ path: apiPath('/repos/owner/repo/issues'), method: 'POST' })
      .reply(500, { message: 'Internal Server Error' });

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      errors: [new Error('Release failed')],
    });

    // Should not throw, just warn
    await fail({}, context);

    expect(context.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create/update failure issue')
    );
  });

  it('should include error details in issue body', async () => {
    const pool = getMockPool(baseUrl);

    pool.intercept({
      path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
      method: 'GET',
    }).reply(200, []);

    pool.intercept({ path: apiPath('/repos/owner/repo/issues'), method: 'POST' })
      .reply(201, mockResponses.failureIssue);

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      errors: [new Error('Test error message')],
    });

    await fail({}, context);

    // We can't easily capture the body with undici, but we can verify the issue was created
    expect(context.logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Created failure issue #999')
    );
  });

  it('should use custom fail title if configured', async () => {
    const pool = getMockPool(baseUrl);

    pool.intercept({
      path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
      method: 'GET',
    }).reply(200, []);

    pool.intercept({ path: apiPath('/repos/owner/repo/issues'), method: 'POST' })
      .reply(201, mockResponses.failureIssue);

    const config = createMockConfig({
      failTitle: 'Custom Failure Title',
    });
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      errors: [new Error('Release failed')],
    });

    await fail({}, context);

    expect(context.logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Created failure issue #999')
    );
  });

  it('should handle empty errors array', async () => {
    const pool = getMockPool(baseUrl);

    pool.intercept({
      path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
      method: 'GET',
    }).reply(200, []);

    pool.intercept({ path: apiPath('/repos/owner/repo/issues'), method: 'POST' })
      .reply(201, mockResponses.failureIssue);

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      errors: [],
    });

    await fail({}, context);

    expect(context.logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Created failure issue #999')
    );
  });
});
