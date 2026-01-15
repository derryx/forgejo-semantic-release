import AggregateError from 'aggregate-error';
import createDebug from 'debug';
import type { ForgejoPluginConfig, PluginContext } from './types.js';
import { resolveConfig, validateConfig } from './resolve-config.js';
import { ForgejoApiClient } from './api-client.js';
import { getError } from './get-error.js';

const debug = createDebug('forgejo-semantic-release:verify');

/**
 * Verify plugin conditions before release
 *
 * This hook:
 * 1. Resolves and validates configuration
 * 2. Tests API connectivity
 * 3. Verifies repository access and permissions
 */
export async function verifyConditions(
  pluginConfig: ForgejoPluginConfig,
  context: PluginContext
): Promise<void> {
  const { logger, cwd } = context;
  const env = process.env;
  const errors: Error[] = [];

  logger.log('Verifying Forgejo release conditions...');
  debug('Plugin config: %O', pluginConfig);

  // Resolve configuration
  const config = resolveConfig(pluginConfig, env, cwd);
  debug('Resolved config: %O', {
    ...config,
    forgejoToken: config.forgejoToken ? '[REDACTED]' : '',
  });

  // Validate required configuration
  try {
    validateConfig(config);
  } catch (error) {
    errors.push(error as Error);
  }

  // If we have basic config errors, throw them now
  if (errors.length > 0) {
    throw new AggregateError(errors);
  }

  // Test API connectivity
  const client = new ForgejoApiClient(config);

  try {
    const user = await client.getCurrentUser();
    logger.log(`Authenticated as ${user.login}`);
  } catch (error) {
    const err = error as { response?: { statusCode: number; statusMessage?: string } };
    errors.push(
      getError('EINVALIDFORGEJOTOKEN', {
        statusCode: err.response?.statusCode || 0,
        statusMessage: err.response?.statusMessage || 'Unknown error',
      })
    );
  }

  // If authentication failed, throw now
  if (errors.length > 0) {
    throw new AggregateError(errors);
  }

  // Verify repository access
  try {
    const repo = await client.getRepository(
      config.repositoryOwner,
      config.repositoryName
    );

    if (!repo.permissions?.push) {
      errors.push(
        getError('ENOPUSHPERMISSION', {
          owner: config.repositoryOwner,
          repo: config.repositoryName,
        })
      );
    } else {
      logger.log(
        `Repository ${config.repositoryOwner}/${config.repositoryName} verified`
      );
    }
  } catch (error) {
    const err = error as { response?: { statusCode: number } };
    if (err.response?.statusCode === 404) {
      errors.push(
        getError('ENOREPO', {
          owner: config.repositoryOwner,
          repo: config.repositoryName,
        })
      );
    } else {
      throw error;
    }
  }

  // Throw any collected errors
  if (errors.length > 0) {
    throw new AggregateError(errors);
  }

  // Store resolved config and client for other hooks
  context.forgejoConfig = config;
  context.forgejoClient = client;
  debug('Verification complete');
}
