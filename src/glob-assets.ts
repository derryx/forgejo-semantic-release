import { globby } from 'globby';
import { stat } from 'node:fs/promises';
import { basename, resolve, isAbsolute } from 'node:path';
import { lookup } from 'mime-types';
import createDebug from 'debug';
import type { AssetConfig, ResolvedAsset, Logger } from './types.js';

const debug = createDebug('forgejo-semantic-release:assets');

/**
 * Check if a path is a valid file
 */
async function isFile(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Resolve glob patterns to actual file paths
 */
export async function globAssets(
  assets: AssetConfig[],
  cwd: string,
  logger?: Logger
): Promise<ResolvedAsset[]> {
  const resolvedAssets: ResolvedAsset[] = [];

  for (const asset of assets) {
    const pattern = asset.path;
    debug('Processing asset pattern: %s', pattern);

    // Check if it's a direct file path (not a glob pattern)
    const absolutePath = isAbsolute(pattern) ? pattern : resolve(cwd, pattern);
    const isDirectFile = await isFile(absolutePath);

    let filePaths: string[];

    if (isDirectFile) {
      // Direct file reference
      filePaths = [absolutePath];
    } else {
      // Glob pattern
      filePaths = await globby(pattern, {
        cwd,
        absolute: true,
        onlyFiles: true,
        expandDirectories: false,
      });
    }

    if (filePaths.length === 0) {
      logger?.warn(`No files found for asset pattern: ${pattern}`);
      debug('No files matched pattern: %s', pattern);
      continue;
    }

    for (const filePath of filePaths) {
      const fileName = asset.name || basename(filePath);
      const mimeType = asset.type || lookup(fileName) || 'application/octet-stream';

      resolvedAssets.push({
        path: filePath,
        name: fileName,
        type: mimeType,
        label: asset.label,
      });

      debug('Resolved asset: %s -> %s (%s)', pattern, fileName, mimeType);
    }
  }

  debug('Total assets resolved: %d', resolvedAssets.length);
  return resolvedAssets;
}
