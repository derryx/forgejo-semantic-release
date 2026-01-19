import { describe, it, expect } from 'vitest';
import { parseGitUrl } from '../../src/utils/parse-git-url.js';

describe('parseGitUrl', () => {
  describe('HTTPS URLs', () => {
    it('should parse HTTPS URL with .git suffix', () => {
      const result = parseGitUrl('https://forgejo.example.com/owner/repo.git');

      expect(result).toEqual({
        url: 'https://forgejo.example.com',
        owner: 'owner',
        repo: 'repo',
      });
    });

    it('should parse HTTPS URL without .git suffix', () => {
      const result = parseGitUrl('https://forgejo.example.com/owner/repo');

      expect(result).toEqual({
        url: 'https://forgejo.example.com',
        owner: 'owner',
        repo: 'repo',
      });
    });

    it('should parse HTTP URL', () => {
      const result = parseGitUrl('http://forgejo.example.com/owner/repo.git');

      expect(result).toEqual({
        url: 'https://forgejo.example.com',
        owner: 'owner',
        repo: 'repo',
      });
    });

    it('should handle trailing .git/ with slash', () => {
      const result = parseGitUrl('https://forgejo.example.com/owner/repo.git/');

      expect(result).toEqual({
        url: 'https://forgejo.example.com',
        owner: 'owner',
        repo: 'repo',
      });
    });
  });

  describe('SSH URLs', () => {
    it('should parse SSH URL format (git@host:owner/repo)', () => {
      const result = parseGitUrl('git@forgejo.example.com:owner/repo.git');

      expect(result).toEqual({
        url: 'https://forgejo.example.com',
        owner: 'owner',
        repo: 'repo',
      });
    });

    it('should parse SSH URL with protocol (ssh://git@host/owner/repo)', () => {
      const result = parseGitUrl('ssh://git@forgejo.example.com/owner/repo.git');

      expect(result).toEqual({
        url: 'https://forgejo.example.com',
        owner: 'owner',
        repo: 'repo',
      });
    });

    it('should parse SSH URL with port (ssh://git@host:port/owner/repo)', () => {
      const result = parseGitUrl('ssh://git@forgejo.example.com:2222/owner/repo.git');

      expect(result).toEqual({
        url: 'https://forgejo.example.com',
        owner: 'owner',
        repo: 'repo',
      });
    });
  });

  describe('invalid inputs', () => {
    it('should return null for empty string', () => {
      const result = parseGitUrl('');

      expect(result).toBeNull();
    });

    it('should return null for invalid URL format', () => {
      const result = parseGitUrl('not-a-valid-url');

      expect(result).toBeNull();
    });

    it('should return null for URL with too many path segments', () => {
      const result = parseGitUrl('https://forgejo.example.com/org/owner/repo.git');

      expect(result).toBeNull();
    });

    it('should return null for URL missing owner/repo', () => {
      const result = parseGitUrl('https://forgejo.example.com/repo.git');

      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle URL with trailing slash but no .git', () => {
      const result = parseGitUrl('https://forgejo.example.com/owner/repo/');

      // Trailing slash without .git results in 3 path segments, which fails the regex
      expect(result).toBeNull();
    });

    it('should parse HTTPS URL with port', () => {
      const result = parseGitUrl('https://forgejo.example.com:8443/owner/repo.git');

      // Port is included in the host part
      expect(result).toEqual({
        url: 'https://forgejo.example.com:8443',
        owner: 'owner',
        repo: 'repo',
      });
    });

    it('should return null for URL with only host', () => {
      const result = parseGitUrl('https://forgejo.example.com');

      expect(result).toBeNull();
    });

    it('should return null for URL with only owner (no repo)', () => {
      const result = parseGitUrl('https://forgejo.example.com/owner');

      expect(result).toBeNull();
    });

    it('should return null for malformed SSH URL missing colon', () => {
      const result = parseGitUrl('git@forgejo.example.com/owner/repo.git');

      expect(result).toBeNull();
    });

    it('should return null for SSH URL with invalid format', () => {
      const result = parseGitUrl('git@forgejo.example.com:owner');

      expect(result).toBeNull();
    });

    it('should handle SSH protocol URL without port', () => {
      const result = parseGitUrl('ssh://git@forgejo.example.com/owner/repo');

      expect(result).toEqual({
        url: 'https://forgejo.example.com',
        owner: 'owner',
        repo: 'repo',
      });
    });

    it('should return null for file:// protocol', () => {
      const result = parseGitUrl('file:///path/to/repo.git');

      expect(result).toBeNull();
    });

    it('should return null for git:// protocol', () => {
      const result = parseGitUrl('git://forgejo.example.com/owner/repo.git');

      expect(result).toBeNull();
    });
  });
});
