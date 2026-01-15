import createDebug from 'debug';
import type {
  ForgejoPluginConfig,
  PluginContext,
  PublishResult,
} from './types.js';
import { ForgejoApiClient } from './api-client.js';
import { globAssets } from './glob-assets.js';
import { getError } from './get-error.js';
import { resolveConfig } from './resolve-config.js';

const debug = createDebug('forgejo-semantic-release:publish');

/**
 * Publish a release to Forgejo
 *
 * This hook:
 * 1. Creates a new release for the git tag
 * 2. Uploads any configured assets
 * 3. Returns the release URL
 */
export async function publish(
  pluginConfig: ForgejoPluginConfig,
  context: PluginContext
): Promise<PublishResult> {
  const { logger, nextRelease, branch, cwd } = context;
  const env = process.env;

  // Use stored config from verify or resolve it
  const config = context.forgejoConfig || resolveConfig(pluginConfig, env, cwd);
  const client = new ForgejoApiClient(config);

  const { gitTag, gitHead, notes } = nextRelease!;
  const isPrerelease = Boolean(branch.prerelease);

  logger.log(`Creating Forgejo release for tag ${gitTag}...`);
  debug('Release details: tag=%s, head=%s, prerelease=%s', gitTag, gitHead, isPrerelease);

  // Create the release
  let release;
  try {
    release = await client.createRelease({
      tag_name: gitTag,
      target_commitish: gitHead,
      name: gitTag,
      body: notes || '',
      draft: false,
      prerelease: isPrerelease,
    });

    logger.log(`Release created: ${release.html_url}`);
    debug('Release id=%d, url=%s', release.id, release.html_url);
  } catch (error) {
    const err = error as Error;
    throw getError('ERELEASECREATION', {
      tag: gitTag,
      error: err.message,
    });
  }

  // Store release for success hook
  context.forgejoRelease = release;

  // Upload assets
  if (config.assets.length > 0) {
    logger.log('Uploading release assets...');

    const resolvedAssets = await globAssets(config.assets, cwd, logger);
    debug('Resolved %d assets to upload', resolvedAssets.length);

    for (const asset of resolvedAssets) {
      try {
        logger.log(`Uploading: ${asset.name}`);
        await client.uploadAsset(release.id, asset.path, asset.name, asset.type);
        debug('Uploaded asset: %s', asset.name);
      } catch (error) {
        const err = error as Error;
        // Log warning but continue with other assets
        logger.warn(`Failed to upload ${asset.name}: ${err.message}`);
        debug('Asset upload failed: %s - %s', asset.name, err.message);
      }
    }

    logger.log(`Uploaded ${resolvedAssets.length} asset(s)`);
  }

  return {
    name: 'Forgejo release',
    url: release.html_url,
  };
}
