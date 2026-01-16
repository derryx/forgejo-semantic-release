import SemanticReleaseError from '@semantic-release/error';
import { ERROR_DEFINITIONS, type ErrorCode } from './definitions/errors.js';

/**
 * Interpolate context values into a string template
 */
function interpolate(str: string, context: Record<string, string | number | undefined>): string {
  return str.replaceAll(/\{(\w+)\}/g, (_, key) => {
    const value = context[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

/**
 * Create a semantic-release error with the given code and context
 */
export function getError(
  code: ErrorCode,
  context: Record<string, string | number | undefined> = {}
): SemanticReleaseError {
  const definition = ERROR_DEFINITIONS[code];

  if (!definition) {
    return new SemanticReleaseError(
      `Unknown error code: ${code}`,
      code,
      'An unexpected error occurred.'
    );
  }

  const { message, details } = definition;

  return new SemanticReleaseError(
    interpolate(message, context),
    code,
    interpolate(details, context)
  );
}
