import createDebug from 'debug';
import { ForgejoApiClient } from './api-client.js';
import { resolveConfig } from './resolve-config.js';
import type { ForgejoPluginConfig, PluginContext, TemplateContext } from './types.js';
import { compileTemplate } from './utils/template.js';

const debug = createDebug('forgejo-semantic-release:fail');

/**
 * Format an error for display in the issue body
 */
function formatError(error: Error): { message: string; details?: string } {
  return {
    message: error.message,
    details: (error as Error & { details?: string }).details,
  };
}

/**
 * Fail hook - create or update an issue documenting release failure
 *
 * This hook:
 * 1. Searches for an existing failure issue
 * 2. Creates a new issue or adds a comment to existing one
 * 3. Applies labels and assignees
 */
export async function fail(
  pluginConfig: ForgejoPluginConfig,
  context: PluginContext
): Promise<void> {
  const { logger, errors, branch, commits, cwd } = context;

  // Use stored config and client from verify, or create new ones as fallback
  const config = context.forgejoConfig || resolveConfig(pluginConfig, process.env, cwd);

  // If we don't have valid config, we can't create issues
  if (!config.forgejoToken || !config.forgejoUrl) {
    logger.warn('Cannot create failure issue: missing Forgejo configuration');
    return;
  }

  const client = context.forgejoClient || new ForgejoApiClient(config);

  logger.log('Creating failure issue...');

  // Prepare template context
  const templateContext: Partial<TemplateContext> = {
    branch: {
      name: branch.name,
      prerelease: branch.prerelease,
      channel: branch.channel,
    },
    commits: commits || [],
    errors: (errors || []).map(formatError) as unknown as Error[],
  };

  // Generate failure content
  const failureBody = compileTemplate(config.failComment, templateContext);

  try {
    // Search for existing failure issue
    const existingIssue = await client.findIssueByTitle(config.failTitle, 'open');

    if (existingIssue?.number !== undefined) {
      // Add comment to existing issue
      await client.createIssueComment(existingIssue.number, failureBody);
      logger.log(`Updated existing failure issue #${existingIssue.number}`);
      debug('Added comment to issue #%d', existingIssue.number);
    } else {
      // Create new issue
      const issue = await client.createIssue({
        title: config.failTitle,
        body: failureBody,
        // NOTE: Forgejo's create-issue API types `labels` as label IDs (number[]),
        // but the plugin is configured with label *names*. This cast preserves the
        // existing runtime behavior; resolving names -> IDs is tracked in TODO.md (#14).
        labels: config.labels as unknown as number[],
        assignees: config.assignees,
      });
      logger.log(`Created failure issue #${issue.number}: ${issue.html_url}`);
      debug('Created issue #%d', issue.number);
    }
  } catch (error) {
    // Log error but don't throw - we don't want to fail the release process further
    logger.warn(`Failed to create/update failure issue: ${(error as Error).message}`);
    debug('Failure issue creation failed: %s', (error as Error).message);
  }
}
