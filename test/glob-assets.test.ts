import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { globAssets } from '../src/glob-assets.js';

const fixturesDir = path.resolve(__dirname, 'fixtures');

describe('globAssets', () => {
  const mockLogger = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  describe('direct file paths', () => {
    it('should resolve a direct file path', async () => {
      const assets = await globAssets(
        [{ path: 'test/fixtures/upload.txt' }],
        path.resolve(__dirname, '..'),
        mockLogger
      );

      expect(assets).toHaveLength(1);
      expect(assets[0].name).toBe('upload.txt');
      expect(assets[0].path).toContain('upload.txt');
      expect(assets[0].type).toBe('text/plain');
    });

    it('should resolve an absolute file path', async () => {
      const absolutePath = path.resolve(fixturesDir, 'upload.txt');
      const assets = await globAssets([{ path: absolutePath }], fixturesDir, mockLogger);

      expect(assets).toHaveLength(1);
      expect(assets[0].path).toBe(absolutePath);
    });

    it('should use custom name if provided', async () => {
      const assets = await globAssets(
        [{ path: 'test/fixtures/upload.txt', name: 'custom-name.txt' }],
        path.resolve(__dirname, '..'),
        mockLogger
      );

      expect(assets).toHaveLength(1);
      expect(assets[0].name).toBe('custom-name.txt');
    });

    it('should use custom mime type if provided', async () => {
      const assets = await globAssets(
        [{ path: 'test/fixtures/upload.txt', type: 'application/custom' }],
        path.resolve(__dirname, '..'),
        mockLogger
      );

      expect(assets).toHaveLength(1);
      expect(assets[0].type).toBe('application/custom');
    });

    it('should include label if provided', async () => {
      const assets = await globAssets(
        [{ path: 'test/fixtures/upload.txt', label: 'Test Asset' }],
        path.resolve(__dirname, '..'),
        mockLogger
      );

      expect(assets).toHaveLength(1);
      expect(assets[0].label).toBe('Test Asset');
    });
  });

  describe('glob patterns', () => {
    it('should resolve glob patterns', async () => {
      const assets = await globAssets(
        [{ path: 'test/fixtures/*.txt' }],
        path.resolve(__dirname, '..'),
        mockLogger
      );

      expect(assets.length).toBeGreaterThanOrEqual(1);
      expect(assets.every((a) => a.name.endsWith('.txt'))).toBe(true);
    });

    it('should resolve nested glob patterns', async () => {
      const assets = await globAssets(
        [{ path: 'test/**/*.txt' }],
        path.resolve(__dirname, '..'),
        mockLogger
      );

      expect(assets.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('missing files', () => {
    it('should warn and skip non-existent files', async () => {
      const warnLogger = {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const assets = await globAssets(
        [{ path: 'non-existent-file.xyz' }],
        path.resolve(__dirname, '..'),
        warnLogger
      );

      expect(assets).toHaveLength(0);
      expect(warnLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No files found')
      );
    });

    it('should skip non-matching glob patterns', async () => {
      const warnLogger = {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const assets = await globAssets(
        [{ path: 'test/fixtures/*.nonexistent' }],
        path.resolve(__dirname, '..'),
        warnLogger
      );

      expect(assets).toHaveLength(0);
      expect(warnLogger.warn).toHaveBeenCalled();
    });
  });

  describe('multiple assets', () => {
    it('should resolve multiple asset patterns', async () => {
      const assets = await globAssets(
        [{ path: 'test/fixtures/upload.txt' }, { path: 'package.json' }],
        path.resolve(__dirname, '..'),
        mockLogger
      );

      expect(assets).toHaveLength(2);
    });

    it('should handle mixed valid and invalid patterns', async () => {
      const warnLogger = {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const assets = await globAssets(
        [{ path: 'test/fixtures/upload.txt' }, { path: 'non-existent.xyz' }],
        path.resolve(__dirname, '..'),
        warnLogger
      );

      expect(assets).toHaveLength(1);
      expect(warnLogger.warn).toHaveBeenCalled();
    });
  });

  describe('mime type detection', () => {
    it('should detect text/plain for .txt files', async () => {
      const assets = await globAssets(
        [{ path: 'test/fixtures/upload.txt' }],
        path.resolve(__dirname, '..'),
        mockLogger
      );

      expect(assets[0].type).toBe('text/plain');
    });

    it('should detect application/json for .json files', async () => {
      const assets = await globAssets(
        [{ path: 'package.json' }],
        path.resolve(__dirname, '..'),
        mockLogger
      );

      expect(assets[0].type).toBe('application/json');
    });

    it('should use application/octet-stream for unknown types', async () => {
      const assets = await globAssets(
        [{ path: 'test/fixtures/upload.txt', name: 'file.unknownext' }],
        path.resolve(__dirname, '..'),
        mockLogger
      );

      expect(assets[0].type).toBe('application/octet-stream');
    });
  });

  describe('empty input', () => {
    it('should return empty array for empty assets', async () => {
      const assets = await globAssets([], path.resolve(__dirname, '..'), mockLogger);

      expect(assets).toHaveLength(0);
    });
  });

  describe('without logger', () => {
    it('should work without logger', async () => {
      const assets = await globAssets(
        [{ path: 'test/fixtures/upload.txt' }],
        path.resolve(__dirname, '..')
      );

      expect(assets).toHaveLength(1);
    });

    it('should silently skip missing files without logger', async () => {
      const assets = await globAssets(
        [{ path: 'non-existent.xyz' }],
        path.resolve(__dirname, '..')
      );

      expect(assets).toHaveLength(0);
    });
  });
});
