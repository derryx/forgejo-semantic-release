import createDebug from 'debug';
import { ForgejoApiClient } from './api-client.js';
import { resolveConfig } from './resolve-config.js';
import type { ForgejoPluginConfig, PluginContext, TemplateContext, ForgejoIssue } from './types.js';
import { compileTemplate, evaluateCondition } from './utils/template.js';

const debug = createDebug('forgejo-semantic-release:success');

// Regex patterns to extract issue references from commit messages
const ISSUE_PATTERNS = [
  // Matches: fixes #123, fix #123, fixed #123
  /fix(?:e[sd])?\s*#(\d+)/gi,
  // Matches: closes #123, close #123, closed #123
  /close[sd]?\s*#(\d+)/gi,
  // Matches: resolves #123, resolve #123, resolved #123
  /resolve[sd]?\s*#(\d+)/gi,
  // Matches: #123 (standalone reference)
  /(?:^|\s)#(\d+)(?:\s|$|[,.])/gi,
];

/**
 * Extract issue numbers from commit messages
 */
function extractIssueNumbers(commits: Array<{ message: string }>): Set<number> {
  const issueNumbers = new Set<number>();

  for (const commit of commits) {
    for (const pattern of ISSUE_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(commit.message)) !== null) {
        const issueNum = Number.parseInt(match[1], 10);
        if (!Number.isNaN(issueNum)) {
          issueNumbers.add(issueNum);
        }
      }
    }
  }

  debug('Extracted issue numbers: %O', Array.from(issueNumbers));
  return issueNumbers;
}

/**
 * Check if a release comment already exists on an issue
 */
async function hasExistingReleaseComment(
  client: ForgejoApiClient,
  issueNumber: number,
  version: string
): Promise<boolean> {
  try {
    const comments = await client.getIssueComments(issueNumber);
    // Check if any comment mentions this version
    return comments.some(
      (comment) => comment.body.includes(version) && comment.body.includes('semantic-release')
    );
  } catch {
    return false;
  }
}

/**
 * Close any existing semantic-release failure issues
 */
async function closeFailureIssues(
  client: ForgejoApiClient,
  failTitle: string,
  logger: { log: (msg: string) => void }
): Promise<void> {
  try {
    const existingIssue = await client.findIssueByTitle(failTitle, 'open');
    if (existingIssue) {
      await client.closeIssue(existingIssue.number);
      logger.log(`Closed failure issue #${existingIssue.number}`);
    }
  } catch (error) {
    debug('Failed to close failure issue: %s', (error as Error).message);
  }
}

interface ProcessIssueParams {
  issueNumber: number;
  client: ForgejoApiClient;
  config: ReturnType<typeof resolveConfig>;
  templateContext: TemplateContext;
  version: string;
  logger: PluginContext['logger'];
}

/**
 * Process a single issue - post comment and add labels
 * Returns true if a comment was posted
 */
async function processIssue(params: ProcessIssueParams): Promise<boolean> {
  const { issueNumber, client, config, templateContext, version, logger } = params;

  // Get issue details
  let issue: ForgejoIssue;
  try {
    issue = await client.getIssue(issueNumber);
  } catch (error) {
    debug('Failed to get issue #%d: %s', issueNumber, (error as Error).message);
    return false;
  }

  // Evaluate condition if set
  if (config.successCommentCondition !== false) {
    const shouldComment = evaluateCondition(config.successCommentCondition, {
      ...templateContext,
      issue,
    });
    if (!shouldComment) {
      debug('Skipping issue #%d due to condition', issueNumber);
      return false;
    }
  }

  // Check for existing comment
  const hasComment = await hasExistingReleaseComment(client, issueNumber, version);
  if (hasComment) {
    debug('Issue #%d already has a release comment', issueNumber);
    return false;
  }

  // Generate and post comment
  const commentBody = compileTemplate(config.successComment, {
    ...templateContext,
    issue,
  });

  await client.createIssueComment(issueNumber, commentBody);
  logger.log(`Commented on issue #${issueNumber}`);

  // Add released labels if configured
  await addReleasedLabels(client, issueNumber, config.releasedLabels);

  return true;
}

/**
 * Add released labels to an issue if configured
 */
async function addReleasedLabels(
  client: ForgejoApiClient,
  issueNumber: number,
  releasedLabels: string[] | false
): Promise<void> {
  if (releasedLabels === false || releasedLabels.length === 0) {
    return;
  }

  try {
    await client.addLabelsToIssue(issueNumber, releasedLabels);
    debug('Added labels to issue #%d', issueNumber);
  } catch (error) {
    debug('Failed to add labels to issue #%d: %s', issueNumber, (error as Error).message);
  }
}

/**
 * Success hook - comment on resolved issues/PRs
 *
 * This hook:
 * 1. Extracts issue references from commit messages
 * 2. Posts comments on resolved issues/PRs
 * 3. Optionally adds labels to released issues
 * 4. Closes any existing failure issues
 */
export async function success(
  pluginConfig: ForgejoPluginConfig,
  context: PluginContext
): Promise<void> {
  const { logger, commits, releases, nextRelease, branch, lastRelease, cwd } = context;

  // Use stored config and client from verify, or create new ones as fallback
  const config = context.forgejoConfig || resolveConfig(pluginConfig, process.env, cwd);
  const client = context.forgejoClient || new ForgejoApiClient(config);

  // Check if success comments are disabled
  if (config.successComment === false) {
    logger.log('Success comments are disabled, skipping...');
    return;
  }

  // Extract issue numbers from commits
  const issueNumbers = extractIssueNumbers(commits || []);
  if (issueNumbers.size === 0) {
    logger.log('No issue references found in commits');
    await closeFailureIssues(client, config.failTitle, logger);
    return;
  }

  logger.log(`Found ${issueNumbers.size} referenced issue(s)/PR(s)`);

  // Prepare template context
  const templateContext: TemplateContext = {
    branch: {
      name: branch.name,
      prerelease: branch.prerelease,
      channel: branch.channel,
    },
    lastRelease: lastRelease || {},
    nextRelease: nextRelease!,
    commits: commits || [],
    releases: releases || [],
  };

  // Process each issue
  let commentedCount = 0;
  for (const issueNumber of issueNumbers) {
    try {
      const commented = await processIssue({
        issueNumber,
        client,
        config,
        templateContext,
        version: nextRelease!.version,
        logger,
      });
      if (commented) {
        commentedCount++;
      }
    } catch (error) {
      logger.warn(`Failed to process issue #${issueNumber}: ${(error as Error).message}`);
      debug('Issue processing failed: #%d - %s', issueNumber, (error as Error).message);
    }
  }

  if (commentedCount > 0) {
    logger.log(`Posted ${commentedCount} success comment(s)`);
  }

  await closeFailureIssues(client, config.failTitle, logger);
}
