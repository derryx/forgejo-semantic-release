import { describe, it, expect } from 'vitest';
import { getError } from '../src/get-error.js';

describe('getError', () => {
  it('should create error with known error code', () => {
    const error = getError('ENOFORGEJOTOKEN');

    expect(error.message).toBe('No Forgejo token specified.');
    expect(error.code).toBe('ENOFORGEJOTOKEN');
    expect(error.details).toContain('FORGEJO_TOKEN');
  });

  it('should interpolate context values into error message', () => {
    const error = getError('ENOREPO', {
      owner: 'testowner',
      repo: 'testrepo',
    });

    expect(error.details).toContain('testowner/testrepo');
  });

  it('should handle unknown error code gracefully', () => {
    // Cast to bypass TypeScript type checking for testing purposes
    const error = getError('UNKNOWN_ERROR_CODE' as Parameters<typeof getError>[0]);

    expect(error.message).toBe('Unknown error code: UNKNOWN_ERROR_CODE');
    expect(error.code).toBe('UNKNOWN_ERROR_CODE');
    expect(error.details).toBe('An unexpected error occurred.');
  });

  it('should preserve placeholder when context value is undefined', () => {
    const error = getError('EINVALIDFORGEJOTOKEN', {
      statusCode: 401,
      // statusMessage intentionally omitted
    });

    expect(error.details).toContain('401');
    expect(error.details).toContain('{statusMessage}');
  });
});
