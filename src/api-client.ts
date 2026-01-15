import got, { type Got } from 'got';
import FormData from 'form-data';
import { createReadStream } from 'node:fs';
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

export class ForgejoApiClient {
  private client: Got;
  private owner: string;
  private repo: string;

  constructor(config: ResolvedConfig) {
    const baseUrl = `${config.forgejoUrl}/api/v1`;
    this.owner = config.repositoryOwner;
    this.repo = config.repositoryName;

    this.client = got.extend({
      prefixUrl: baseUrl,
      headers: {
        Authorization: `token ${config.forgejoToken}`,
      },
      retry: {
        limit: 3,
        statusCodes: [408, 429, 500, 502, 503, 504],
      },
      timeout: {
        request: 30000,
      },
    });
    debug('API client initialized for %s/%s at %s', this.owner, this.repo, baseUrl);
  }

  /**
   * Get the currently authenticated user
   */
  async getCurrentUser(): Promise<ForgejoUser> {
    debug('Getting current user');
    const response = await this.client.get('user').json<ForgejoUser>();
    debug('Authenticated as %s', response.login);
    return response;
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<ForgejoRepository> {
    debug('Getting repository %s/%s', owner, repo);
    return this.client.get(`repos/${owner}/${repo}`).json<ForgejoRepository>();
  }

  /**
   * Create a new release
   */
  async createRelease(options: CreateReleaseOptions): Promise<ForgejoRelease> {
    debug('Creating release for tag %s', options.tag_name);
    const response = await this.client
      .post(`repos/${this.owner}/${this.repo}/releases`, {
        json: options,
      })
      .json<ForgejoRelease>();
    debug('Release created with id %d', response.id);
    return response;
  }

  /**
   * Get a release by tag name
   */
  async getReleaseByTag(tag: string): Promise<ForgejoRelease | null> {
    debug('Getting release for tag %s', tag);
    try {
      return await this.client
        .get(`repos/${this.owner}/${this.repo}/releases/tags/${tag}`)
        .json<ForgejoRelease>();
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

    const form = new FormData();
    const contentType = mimeType || lookup(fileName) || 'application/octet-stream';

    form.append('attachment', createReadStream(filePath), {
      filename: fileName,
      contentType,
    });

    const response = await this.client
      .post(`repos/${this.owner}/${this.repo}/releases/${releaseId}/assets`, {
        searchParams: { name: fileName },
        body: form,
        headers: {
          ...form.getHeaders(),
        },
      })
      .json<ForgejoAsset>();

    debug('Asset uploaded with id %d', response.id);
    return response;
  }

  /**
   * Get an issue by number
   */
  async getIssue(issueNumber: number): Promise<ForgejoIssue> {
    debug('Getting issue #%d', issueNumber);
    return this.client
      .get(`repos/${this.owner}/${this.repo}/issues/${issueNumber}`)
      .json<ForgejoIssue>();
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
    return this.client
      .get(`repos/${this.owner}/${this.repo}/issues`, { searchParams })
      .json<ForgejoIssue[]>();
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
    const response = await this.client
      .post(`repos/${this.owner}/${this.repo}/issues`, {
        json: options,
      })
      .json<ForgejoIssue>();
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
    return this.client
      .patch(`repos/${this.owner}/${this.repo}/issues/${issueNumber}`, {
        json: options,
      })
      .json<ForgejoIssue>();
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
    return this.client
      .get(`repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`)
      .json<ForgejoComment[]>();
  }

  /**
   * Create a comment on an issue
   */
  async createIssueComment(
    issueNumber: number,
    body: string
  ): Promise<ForgejoComment> {
    debug('Creating comment on issue #%d', issueNumber);
    const response = await this.client
      .post(`repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`, {
        json: { body },
      })
      .json<ForgejoComment>();
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
    return this.client
      .post(`repos/${this.owner}/${this.repo}/issues/${issueNumber}/labels`, {
        json: { labels },
      })
      .json<ForgejoIssue>();
  }
}
