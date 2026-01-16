import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import { publish } from '../src/publish.js';
import { createMockContext, createMockConfig, mockResponses } from './helpers/mock-context.js';
import { setupMockAgent, cleanupMock, getMockPool, apiPath } from './helpers/mock-forgejo.js';
import { ForgejoApiClient } from '../src/api-client.js';

describe('publish', () => {
  const baseUrl = 'https://forgejo.example.com';

  beforeEach(() => {
    setupMockAgent();
  });

  afterEach(() => {
    cleanupMock();
  });

  it('should create a release', async () => {
    const pool = getMockPool(baseUrl);
    pool.intercept({ path: apiPath('/repos/owner/repo/releases'), method: 'POST' })
      .reply(201, mockResponses.release);

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
    });

    const result = await publish({}, context);

    expect(result).toEqual({
      name: 'Forgejo release',
      url: 'https://forgejo.example.com/owner/repo/releases/tag/v1.0.0',
    });
    expect(context.forgejoRelease).toBeDefined();
    expect(context.logger.log).toHaveBeenCalledWith('Creating Forgejo release for tag v1.0.0...');
  });

  it('should create a prerelease for prerelease branches', async () => {
    const pool = getMockPool(baseUrl);
    pool.intercept({ path: apiPath('/repos/owner/repo/releases'), method: 'POST' })
      .reply(201, { ...mockResponses.release, prerelease: true });

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      branch: {
        name: 'beta',
        prerelease: true,
        channel: 'beta',
      },
    });

    const result = await publish({}, context);

    expect(result.url).toBeDefined();
  });

  it('should upload assets with the release', async () => {
    const pool = getMockPool(baseUrl);
    pool.intercept({ path: apiPath('/repos/owner/repo/releases'), method: 'POST' })
      .reply(201, mockResponses.release);
    pool.intercept({
      path: (path) => path.startsWith(apiPath('/repos/owner/repo/releases/1/assets')),
      method: 'POST',
    }).reply(201, mockResponses.asset);

    const config = createMockConfig({
      assets: [{ path: 'test/fixtures/upload.txt' }],
    });
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      cwd: path.resolve(__dirname, '..'),
    });

    const result = await publish({}, context);

    expect(result.url).toBeDefined();
    expect(context.logger.log).toHaveBeenCalledWith('Uploading: upload.txt');
  });

  it('should continue if asset upload fails', async () => {
    const pool = getMockPool(baseUrl);
    pool.intercept({ path: apiPath('/repos/owner/repo/releases'), method: 'POST' })
      .reply(201, mockResponses.release);
    pool.intercept({
      path: (path) => path.startsWith(apiPath('/repos/owner/repo/releases/1/assets')),
      method: 'POST',
    }).reply(500, { message: 'Internal Server Error' });

    const config = createMockConfig({
      assets: [{ path: 'test/fixtures/upload.txt' }],
    });
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      cwd: path.resolve(__dirname, '..'),
    });

    // Should not throw, just warn
    const result = await publish({}, context);

    expect(result.url).toBeDefined();
    expect(context.logger.warn).toHaveBeenCalled();
  });

  it('should throw error when release creation fails', async () => {
    const pool = getMockPool(baseUrl);
    pool.intercept({ path: apiPath('/repos/owner/repo/releases'), method: 'POST' })
      .reply(422, { message: 'Tag already exists' });

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
    });

    await expect(publish({}, context)).rejects.toThrow('Failed to create Forgejo release');
  });

  it('should store release in context for success hook', async () => {
    const pool = getMockPool(baseUrl);
    pool.intercept({ path: apiPath('/repos/owner/repo/releases'), method: 'POST' })
      .reply(201, mockResponses.release);

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
    });

    await publish({}, context);

    expect(context.forgejoRelease).toEqual(mockResponses.release);
  });

  it('should work without pre-stored config (fallback mode)', async () => {
    const pool = getMockPool(baseUrl);
    pool.intercept({ path: apiPath('/repos/owner/repo/releases'), method: 'POST' })
      .reply(201, mockResponses.release);

    const context = createMockContext();
    // Manually set the URL parsing results since we're not in a git repo
    context.forgejoConfig = createMockConfig();
    context.forgejoClient = new ForgejoApiClient(context.forgejoConfig);

    const result = await publish({}, context);

    expect(result.url).toBeDefined();
  });
});
