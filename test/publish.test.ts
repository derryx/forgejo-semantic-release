import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { publish } from '../src';
import { ForgejoApiClient } from '../src/api-client.js';
import { createMockContext, createMockConfig, mockResponses } from './helpers/mock-context.js';
import { setupMockAgent, cleanupMock, getMockPool, apiPath } from './helpers/mock-forgejo.js';

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
    pool
      .intercept({
        path: apiPath('/repos/owner/repo/releases'),
        method: 'POST',
      })
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
    pool
      .intercept({
        path: apiPath('/repos/owner/repo/releases'),
        method: 'POST',
      })
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
    pool
      .intercept({
        path: apiPath('/repos/owner/repo/releases'),
        method: 'POST',
      })
      .reply(201, mockResponses.release);
    pool
      .intercept({
        path: (path) => path.startsWith(apiPath('/repos/owner/repo/releases/1/assets')),
        method: 'POST',
      })
      .reply(201, mockResponses.asset);

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
    pool
      .intercept({
        path: apiPath('/repos/owner/repo/releases'),
        method: 'POST',
      })
      .reply(201, mockResponses.release);
    pool
      .intercept({
        path: (path) => path.startsWith(apiPath('/repos/owner/repo/releases/1/assets')),
        method: 'POST',
      })
      .reply(500, { message: 'Internal Server Error' });

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
    pool
      .intercept({
        path: apiPath('/repos/owner/repo/releases'),
        method: 'POST',
      })
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
    pool
      .intercept({
        path: apiPath('/repos/owner/repo/releases'),
        method: 'POST',
      })
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
    pool
      .intercept({
        path: apiPath('/repos/owner/repo/releases'),
        method: 'POST',
      })
      .reply(201, mockResponses.release);

    const context = createMockContext();
    // Manually set the URL parsing results since we're not in a git repo
    context.forgejoConfig = createMockConfig();
    context.forgejoClient = new ForgejoApiClient(context.forgejoConfig);

    const result = await publish({}, context);

    expect(result.url).toBeDefined();
  });

  it('should create release with draft: false', async () => {
    const pool = getMockPool(baseUrl);
    let capturedBody: Record<string, unknown> = {};

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/releases'),
        method: 'POST',
        body: (body) => {
          capturedBody = JSON.parse(body);
          return true;
        },
      })
      .reply(201, mockResponses.release);

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
    });

    await publish({}, context);

    expect(capturedBody.draft).toBe(false);
  });

  it('should not upload assets when assets array is empty', async () => {
    const pool = getMockPool(baseUrl);
    let assetUploadCalled = false;

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/releases'),
        method: 'POST',
      })
      .reply(201, mockResponses.release);

    // This intercept should NOT be called
    pool
      .intercept({
        path: (path) => {
          if (path.startsWith(apiPath('/repos/owner/repo/releases/1/assets'))) {
            assetUploadCalled = true;
          }
          return path.startsWith(apiPath('/repos/owner/repo/releases/1/assets'));
        },
        method: 'POST',
      })
      .reply(201, mockResponses.asset);

    const config = createMockConfig({ assets: [] }); // Empty assets array
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
    });

    await publish({}, context);

    expect(assetUploadCalled).toBe(false);
    // Also verify we didn't log "Uploading release assets..."
    expect(context.logger.log).not.toHaveBeenCalledWith('Uploading release assets...');
  });

  it('should log uploading message only when assets exist', async () => {
    const pool = getMockPool(baseUrl);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/releases'),
        method: 'POST',
      })
      .reply(201, mockResponses.release);

    pool
      .intercept({
        path: (path) => path.startsWith(apiPath('/repos/owner/repo/releases/1/assets')),
        method: 'POST',
      })
      .reply(201, mockResponses.asset);

    const config = createMockConfig({
      assets: [{ path: 'test/fixtures/upload.txt' }],
    });
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      cwd: path.resolve(__dirname, '..'),
    });

    await publish({}, context);

    expect(context.logger.log).toHaveBeenCalledWith('Uploading release assets...');
  });

  it('should log uploaded assets count', async () => {
    const pool = getMockPool(baseUrl);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/releases'),
        method: 'POST',
      })
      .reply(201, mockResponses.release);

    pool
      .intercept({
        path: (path) => path.startsWith(apiPath('/repos/owner/repo/releases/1/assets')),
        method: 'POST',
      })
      .reply(201, mockResponses.asset);

    const config = createMockConfig({
      assets: [{ path: 'test/fixtures/upload.txt' }],
    });
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      cwd: path.resolve(__dirname, '..'),
    });

    await publish({}, context);

    expect(context.logger.log).toHaveBeenCalledWith('Uploaded 1 asset(s)');
  });

  it('should log release created message with URL', async () => {
    const pool = getMockPool(baseUrl);

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/releases'),
        method: 'POST',
      })
      .reply(201, mockResponses.release);

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
    });

    await publish({}, context);

    expect(context.logger.log).toHaveBeenCalledWith(
      'Release created: https://forgejo.example.com/owner/repo/releases/tag/v1.0.0'
    );
  });

  it('should set prerelease to true for prerelease branches', async () => {
    const pool = getMockPool(baseUrl);
    let capturedBody: Record<string, unknown> = {};

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/releases'),
        method: 'POST',
        body: (body) => {
          capturedBody = JSON.parse(body);
          return true;
        },
      })
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

    await publish({}, context);

    expect(capturedBody.prerelease).toBe(true);
  });

  it('should set prerelease to false for non-prerelease branches', async () => {
    const pool = getMockPool(baseUrl);
    let capturedBody: Record<string, unknown> = {};

    pool
      .intercept({
        path: apiPath('/repos/owner/repo/releases'),
        method: 'POST',
        body: (body) => {
          capturedBody = JSON.parse(body);
          return true;
        },
      })
      .reply(201, mockResponses.release);

    const config = createMockConfig();
    const context = createMockContext({
      forgejoConfig: config,
      forgejoClient: new ForgejoApiClient(config),
      branch: {
        name: 'main',
        prerelease: false,
        channel: undefined,
      },
    });

    await publish({}, context);

    expect(capturedBody.prerelease).toBe(false);
  });
});
