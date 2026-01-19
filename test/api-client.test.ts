import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ForgejoApiClient } from '../src/api-client.js';
import { createMockConfig, mockResponses } from './helpers/mock-context.js';
import { setupMockAgent, cleanupMock, getMockPool, apiPath } from './helpers/mock-forgejo.js';

describe('ForgejoApiClient', () => {
  let client: ForgejoApiClient;
  const baseUrl = 'https://forgejo.example.com';

  beforeEach(() => {
    setupMockAgent();
    client = new ForgejoApiClient(createMockConfig());
  });

  afterEach(() => {
    cleanupMock();
  });

  describe('getCurrentUser', () => {
    it('should return the authenticated user', async () => {
      const pool = getMockPool(baseUrl);
      pool.intercept({ path: apiPath('/user'), method: 'GET' }).reply(200, mockResponses.user);

      const user = await client.getCurrentUser();

      expect(user.login).toBe('testuser');
      expect(user.email).toBe('test@example.com');
    });

    it('should throw on authentication failure', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({ path: apiPath('/user'), method: 'GET' })
        .reply(401, { message: 'Unauthorized' });

      await expect(client.getCurrentUser()).rejects.toThrow();
    });
  });

  describe('getRepository', () => {
    it('should return repository information', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({ path: apiPath('/repos/owner/repo'), method: 'GET' })
        .reply(200, mockResponses.repository);

      const repo = await client.getRepository('owner', 'repo');

      expect(repo.full_name).toBe('owner/repo');
      expect(repo.permissions.push).toBe(true);
    });

    it('should throw on repository not found', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({ path: apiPath('/repos/owner/nonexistent'), method: 'GET' })
        .reply(404, { message: 'Not Found' });

      await expect(client.getRepository('owner', 'nonexistent')).rejects.toThrow();
    });
  });

  describe('createRelease', () => {
    it('should create a release', async () => {
      const releaseOptions = {
        tag_name: 'v1.0.0',
        target_commitish: 'abc123',
        name: 'v1.0.0',
        body: 'Release notes',
        draft: false,
        prerelease: false,
      };

      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: apiPath('/repos/owner/repo/releases'),
          method: 'POST',
        })
        .reply(201, mockResponses.release);

      const release = await client.createRelease(releaseOptions);

      expect(release.id).toBe(1);
      expect(release.tag_name).toBe('v1.0.0');
    });

    it('should throw on release creation failure', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: apiPath('/repos/owner/repo/releases'),
          method: 'POST',
        })
        .reply(422, { message: 'Tag already exists' });

      await expect(
        client.createRelease({
          tag_name: 'v1.0.0',
          target_commitish: 'abc123',
          name: 'v1.0.0',
          body: 'Release notes',
        })
      ).rejects.toThrow();
    });
  });

  describe('getReleaseByTag', () => {
    it('should return release for existing tag', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: apiPath('/repos/owner/repo/releases/tags/v1.0.0'),
          method: 'GET',
        })
        .reply(200, mockResponses.release);

      const release = await client.getReleaseByTag('v1.0.0');

      expect(release).not.toBeNull();
      expect(release?.tag_name).toBe('v1.0.0');
    });

    it('should return null for non-existent tag', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: apiPath('/repos/owner/repo/releases/tags/v99.0.0'),
          method: 'GET',
        })
        .reply(404, { message: 'Not Found' });

      const release = await client.getReleaseByTag('v99.0.0');

      expect(release).toBeNull();
    });

    it('should throw on non-404 errors', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: apiPath('/repos/owner/repo/releases/tags/v1.0.0'),
          method: 'GET',
        })
        .reply(500, { message: 'Internal Server Error' });

      await expect(client.getReleaseByTag('v1.0.0')).rejects.toThrow();
    });
  });

  describe('getIssue', () => {
    it('should return an issue by number', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: apiPath('/repos/owner/repo/issues/123'),
          method: 'GET',
        })
        .reply(200, mockResponses.issue);

      const issue = await client.getIssue(123);

      expect(issue.number).toBe(123);
      expect(issue.state).toBe('open');
    });

    it('should throw on issue not found', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: apiPath('/repos/owner/repo/issues/999'),
          method: 'GET',
        })
        .reply(404, { message: 'Not Found' });

      await expect(client.getIssue(999)).rejects.toThrow();
    });
  });

  describe('searchIssues', () => {
    it('should search issues with default parameters', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
          method: 'GET',
        })
        .reply(200, [mockResponses.issue]);

      const issues = await client.searchIssues();

      expect(issues).toHaveLength(1);
    });

    it('should search issues with custom state', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: (path) =>
            path.startsWith(apiPath('/repos/owner/repo/issues')) && path.includes('state=open'),
          method: 'GET',
        })
        .reply(200, [mockResponses.issue]);

      const issues = await client.searchIssues('open');

      expect(issues).toHaveLength(1);
    });

    it('should search issues with query', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
          method: 'GET',
        })
        .reply(200, [mockResponses.issue]);

      const issues = await client.searchIssues('open', {
        query: 'test search',
      });

      expect(issues).toHaveLength(1);
    });

    it('should search issues with labels', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: (path) =>
            path.startsWith(apiPath('/repos/owner/repo/issues')) &&
            path.includes('labels=bug%2Cenhancement'),
          method: 'GET',
        })
        .reply(200, [mockResponses.issue]);

      const issues = await client.searchIssues('all', {
        labels: ['bug', 'enhancement'],
      });

      expect(issues).toHaveLength(1);
    });

    it('should NOT include labels param when labels array is empty', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: (path) =>
            path.startsWith(apiPath('/repos/owner/repo/issues')) && !path.includes('labels='),
          method: 'GET',
        })
        .reply(200, [mockResponses.issue]);

      const issues = await client.searchIssues('all', {
        labels: [],
      });

      expect(issues).toHaveLength(1);
    });

    it('should include query param when provided', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: (path) =>
            path.startsWith(apiPath('/repos/owner/repo/issues')) && path.includes('q='),
          method: 'GET',
        })
        .reply(200, [mockResponses.issue]);

      const issues = await client.searchIssues('open', {
        query: 'search term',
      });

      expect(issues).toHaveLength(1);
    });

    it('should NOT include query param when not provided', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: (path) =>
            path.startsWith(apiPath('/repos/owner/repo/issues')) && !path.includes('q='),
          method: 'GET',
        })
        .reply(200, [mockResponses.issue]);

      const issues = await client.searchIssues('all', {});

      expect(issues).toHaveLength(1);
    });
  });

  describe('findIssueByTitle', () => {
    it('should find issue with exact title match', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
          method: 'GET',
        })
        .reply(200, [
          { ...mockResponses.issue, title: 'Other Issue' },
          { ...mockResponses.issue, number: 456, title: 'Exact Match' },
        ]);

      const issue = await client.findIssueByTitle('Exact Match');

      expect(issue).not.toBeNull();
      expect(issue?.number).toBe(456);
    });

    it('should return null when no exact match found', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: (path) => path.startsWith(apiPath('/repos/owner/repo/issues')),
          method: 'GET',
        })
        .reply(200, [{ ...mockResponses.issue, title: 'Different Title' }]);

      const issue = await client.findIssueByTitle('Non-existent Title');

      expect(issue).toBeNull();
    });
  });

  describe('createIssue', () => {
    it('should create an issue', async () => {
      const issueOptions = {
        title: 'New Issue',
        body: 'Issue description',
        labels: ['bug'],
        assignees: ['testuser'],
      };

      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: apiPath('/repos/owner/repo/issues'),
          method: 'POST',
        })
        .reply(201, { ...mockResponses.issue, ...issueOptions });

      const issue = await client.createIssue(issueOptions);

      expect(issue.title).toBe('New Issue');
    });
  });

  describe('updateIssue', () => {
    it('should update an issue', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: apiPath('/repos/owner/repo/issues/123'),
          method: 'PATCH',
        })
        .reply(200, { ...mockResponses.issue, title: 'Updated Title' });

      const issue = await client.updateIssue(123, { title: 'Updated Title' });

      expect(issue.title).toBe('Updated Title');
    });
  });

  describe('closeIssue', () => {
    it('should close an issue', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: apiPath('/repos/owner/repo/issues/123'),
          method: 'PATCH',
        })
        .reply(200, { ...mockResponses.issue, state: 'closed' });

      const issue = await client.closeIssue(123);

      expect(issue.state).toBe('closed');
    });
  });

  describe('getIssueComments', () => {
    it('should return issue comments', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: apiPath('/repos/owner/repo/issues/123/comments'),
          method: 'GET',
        })
        .reply(200, [mockResponses.comment]);

      const comments = await client.getIssueComments(123);

      expect(comments).toHaveLength(1);
      expect(comments[0].body).toBe('Test comment');
    });
  });

  describe('createIssueComment', () => {
    it('should create a comment on an issue', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: apiPath('/repos/owner/repo/issues/123/comments'),
          method: 'POST',
        })
        .reply(201, { ...mockResponses.comment, body: 'New comment' });

      const comment = await client.createIssueComment(123, 'New comment');

      expect(comment.body).toBe('New comment');
    });
  });

  describe('addLabelsToIssue', () => {
    it('should add labels to an issue', async () => {
      const pool = getMockPool(baseUrl);
      pool
        .intercept({
          path: apiPath('/repos/owner/repo/issues/123/labels'),
          method: 'POST',
        })
        .reply(200, mockResponses.issue);

      const issue = await client.addLabelsToIssue(123, ['bug', 'urgent']);

      expect(issue).toBeDefined();
    });
  });

  describe('request headers', () => {
    it('should set Content-Type header to application/json for string body', async () => {
      const pool = getMockPool(baseUrl);
      let capturedHeaders: Record<string, string> = {};

      pool
        .intercept({
          path: apiPath('/repos/owner/repo/issues'),
          method: 'POST',
          headers: (headers) => {
            capturedHeaders = headers as Record<string, string>;
            return true;
          },
        })
        .reply(201, mockResponses.issue);

      await client.createIssue({ title: 'Test', body: 'Test body' });

      expect(capturedHeaders['content-type']).toBe('application/json');
    });

    it('should NOT set Content-Type header for GET requests without body', async () => {
      const pool = getMockPool(baseUrl);
      let capturedHeaders: Record<string, string> = {};

      pool
        .intercept({
          path: apiPath('/user'),
          method: 'GET',
          headers: (headers) => {
            capturedHeaders = headers as Record<string, string>;
            return true;
          },
        })
        .reply(200, mockResponses.user);

      await client.getCurrentUser();

      // Content-Type should not be set for GET requests without body
      expect(capturedHeaders['content-type']).toBeUndefined();
    });

    it('should include Authorization header in requests', async () => {
      const pool = getMockPool(baseUrl);
      let capturedHeaders: Record<string, string> = {};

      pool
        .intercept({
          path: apiPath('/user'),
          method: 'GET',
          headers: (headers) => {
            capturedHeaders = headers as Record<string, string>;
            return true;
          },
        })
        .reply(200, mockResponses.user);

      await client.getCurrentUser();

      expect(capturedHeaders['authorization']).toBe('token test-token-123');
    });
  });

  describe('uploadAsset', () => {
    it('should upload asset with auto-detected MIME type', async () => {
      const pool = getMockPool(baseUrl);

      pool
        .intercept({
          path: (path) => path.startsWith(apiPath('/repos/owner/repo/releases/1/assets')),
          method: 'POST',
        })
        .reply(201, mockResponses.asset);

      // Upload a .txt file - should auto-detect as text/plain
      const asset = await client.uploadAsset(1, 'test/fixtures/upload.txt', 'upload.txt');

      expect(asset.id).toBe(1);
    });

    it('should upload asset with custom MIME type when provided', async () => {
      const pool = getMockPool(baseUrl);
      let capturedContentType = '';

      pool
        .intercept({
          path: (path) => path.startsWith(apiPath('/repos/owner/repo/releases/1/assets')),
          method: 'POST',
          headers: (headers) => {
            const contentType = (headers as Record<string, string>)['content-type'];
            if (contentType) {
              capturedContentType = contentType;
            }
            return true;
          },
        })
        .reply(201, mockResponses.asset);

      await client.uploadAsset(1, 'test/fixtures/upload.txt', 'upload.txt', 'application/custom');

      expect(capturedContentType).toContain('multipart/form-data');
    });

    it('should fallback to application/octet-stream for unknown file types', async () => {
      const pool = getMockPool(baseUrl);

      pool
        .intercept({
          path: (path) => path.startsWith(apiPath('/repos/owner/repo/releases/1/assets')),
          method: 'POST',
        })
        .reply(201, mockResponses.asset);

      // Upload with an unknown extension - should fallback to application/octet-stream
      const asset = await client.uploadAsset(1, 'test/fixtures/upload.txt', 'file.unknownext');

      expect(asset.id).toBe(1);
    });

    it('should throw error when upload fails', async () => {
      const pool = getMockPool(baseUrl);

      pool
        .intercept({
          path: (path) => path.startsWith(apiPath('/repos/owner/repo/releases/1/assets')),
          method: 'POST',
        })
        .reply(500, { message: 'Internal Server Error' });

      await expect(
        client.uploadAsset(1, 'test/fixtures/upload.txt', 'upload.txt')
      ).rejects.toThrow();
    });
  });
});
