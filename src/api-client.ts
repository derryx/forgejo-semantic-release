import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { lookup } from 'mime-types';
import createDebug from 'debug';
import type {
  ResolvedConfig,
  ForgejoUser,
  ForgejoRepository,
  ForgejoRelease,
  ForgejoAsset,
  ForgejoIssue,
  ForgejoComment,
  CreateReleaseOptions,
  CreateIssueOptions,
} from './types.js';

const debug = createDebug('forgejo-semantic-release:api');

interface FetchOptions {
  method?: string;
  body?: string | Buffer | NodeJS.ReadableStream;
  headers?: Record<string, string>;
  searchParams?: Record<string, string | number>;
}

export class ForgejoApiClient {
  private baseUrl: string;
  private token: string;
  private owner: string;
  private repo: string;

  constructor(config: ResolvedConfig) {
    this.baseUrl = `${config.forgejoUrl}/api/v1`;
    this.token = config.forgejoToken;
    this.owner = config.repositoryOwner;
    this.repo = config.repositoryName;
    debug('API client initialized for %s/%s at %s', this.owner, this.repo, this.baseUrl);
  }

  private async request<T>(path: string, options: FetchOptions = {}): Promise<T> {
    let url = `${this.baseUrl}/${path}`;

    if (options.searchParams) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.searchParams)) {
        params.append(key, String(value));
      }
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {
      Authorization: `token ${this.token}`,
      ...options.headers,
    };

    if (options.body && typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: options.body as any,
    });

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as Error & {
        response: { statusCode: number; statusMessage: string };
      };
      error.response = {
        statusCode: response.status,
        statusMessage: response.statusText,
      };
      throw error;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : ({} as T);
  }

  /**
   * Get the currently authenticated user
   */
  async getCurrentUser(): Promise<ForgejoUser> {
    debug('Getting current user');
    const response = await this.request<ForgejoUser>('user');
    debug('Authenticated as %s', response.login);
    return response;
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<ForgejoRepository> {
    debug('Getting repository %s/%s', owner, repo);
    return this.request<ForgejoRepository>(`repos/${owner}/${repo}`);
  }

  /**
   * Create a new release
   */
  async createRelease(options: CreateReleaseOptions): Promise<ForgejoRelease> {
    debug('Creating release for tag %s', options.tag_name);
    const response = await this.request<ForgejoRelease>(
      `repos/${this.owner}/${this.repo}/releases`,
      {
        method: 'POST',
        body: JSON.stringify(options),
      }
    );
    debug('Release created with id %d', response.id);
    return response;
  }

  /**
   * Get a release by tag name
   */
  async getReleaseByTag(tag: string): Promise<ForgejoRelease | null> {
    debug('Getting release for tag %s', tag);
    try {
      return await this.request<ForgejoRelease>(
        `repos/${this.owner}/${this.repo}/releases/tags/${tag}`
      );
    } catch (error) {
      if ((error as { response?: { statusCode: number } }).response?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Upload an asset to a release
   */
  async uploadAsset(
    releaseId: number,
    filePath: string,
    fileName: string,
    mimeType?: string
  ): Promise<ForgejoAsset> {
    debug('Uploading asset %s to release %d', fileName, releaseId);

    const contentType = mimeType || lookup(fileName) || 'application/octet-stream';
    const fileStats = await stat(filePath);

    // Read file into buffer for fetch
    const chunks: Buffer[] = [];
    const stream = createReadStream(filePath);

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const fileBuffer = Buffer.concat(chunks);

    // Build multipart form data manually
    const boundary = `----FormBoundary${Date.now()}`;
    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="attachment"; filename="${fileName}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, fileBuffer, footer]);

    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `token ${this.token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    });

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as Error & {
        response: { statusCode: number; statusMessage: string };
      };
      error.response = {
        statusCode: response.status,
        statusMessage: response.statusText,
      };
      throw error;
    }

    const result = await response.json() as ForgejoAsset;
    debug('Asset uploaded with id %d', result.id);
    return result;
  }

  /**
   * Get an issue by number
   */
  async getIssue(issueNumber: number): Promise<ForgejoIssue> {
    debug('Getting issue #%d', issueNumber);
    return this.request<ForgejoIssue>(
      `repos/${this.owner}/${this.repo}/issues/${issueNumber}`
    );
  }

  /**
   * Search for issues with pagination support
   */
  async searchIssues(
    state: 'open' | 'closed' | 'all' = 'all',
    options: {
      labels?: string[];
      query?: string;
      limit?: number;
    } = {}
  ): Promise<ForgejoIssue[]> {
    debug('Searching issues with state=%s, query=%s', state, options.query);
    const searchParams: Record<string, string | number> = {
      state,
      limit: options.limit || 50,
    };
    if (options.labels && options.labels.length > 0) {
      searchParams.labels = options.labels.join(',');
    }
    if (options.query) {
      searchParams.q = options.query;
    }
    return this.request<ForgejoIssue[]>(
      `repos/${this.owner}/${this.repo}/issues`,
      { searchParams }
    );
  }

  /**
   * Find an issue by exact title match
   * Uses search API with title query for efficiency
   */
  async findIssueByTitle(
    title: string,
    state: 'open' | 'closed' | 'all' = 'open'
  ): Promise<ForgejoIssue | null> {
    debug('Finding issue with title: %s', title);

    // Use search query to narrow down results
    const issues = await this.searchIssues(state, {
      query: title,
      limit: 100,
    });

    // Filter for exact title match (search API does partial matching)
    return issues.find((issue) => issue.title === title) || null;
  }

  /**
   * Create a new issue
   */
  async createIssue(options: CreateIssueOptions): Promise<ForgejoIssue> {
    debug('Creating issue: %s', options.title);
    const response = await this.request<ForgejoIssue>(
      `repos/${this.owner}/${this.repo}/issues`,
      {
        method: 'POST',
        body: JSON.stringify(options),
      }
    );
    debug('Issue created: #%d', response.number);
    return response;
  }

  /**
   * Update an issue
   */
  async updateIssue(
    issueNumber: number,
    options: Partial<CreateIssueOptions & { state: 'open' | 'closed' }>
  ): Promise<ForgejoIssue> {
    debug('Updating issue #%d', issueNumber);
    return this.request<ForgejoIssue>(
      `repos/${this.owner}/${this.repo}/issues/${issueNumber}`,
      {
        method: 'PATCH',
        body: JSON.stringify(options),
      }
    );
  }

  /**
   * Close an issue
   */
  async closeIssue(issueNumber: number): Promise<ForgejoIssue> {
    debug('Closing issue #%d', issueNumber);
    return this.updateIssue(issueNumber, { state: 'closed' });
  }

  /**
   * Get comments on an issue
   */
  async getIssueComments(issueNumber: number): Promise<ForgejoComment[]> {
    debug('Getting comments for issue #%d', issueNumber);
    return this.request<ForgejoComment[]>(
      `repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`
    );
  }

  /**
   * Create a comment on an issue
   */
  async createIssueComment(
    issueNumber: number,
    body: string
  ): Promise<ForgejoComment> {
    debug('Creating comment on issue #%d', issueNumber);
    const response = await this.request<ForgejoComment>(
      `repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ body }),
      }
    );
    debug('Comment created with id %d', response.id);
    return response;
  }

  /**
   * Add labels to an issue
   */
  async addLabelsToIssue(
    issueNumber: number,
    labels: string[]
  ): Promise<ForgejoIssue> {
    debug('Adding labels to issue #%d: %s', issueNumber, labels.join(', '));
    // Forgejo expects label IDs, but we can use the labels endpoint
    // that accepts label names via POST body
    return this.request<ForgejoIssue>(
      `repos/${this.owner}/${this.repo}/issues/${issueNumber}/labels`,
      {
        method: 'POST',
        body: JSON.stringify({ labels }),
      }
    );
  }
}
