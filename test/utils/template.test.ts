import { describe, it, expect } from 'vitest';
import { compileTemplate, evaluateCondition } from '../../src/utils/template.js';

describe('compileTemplate', () => {
  it('should interpolate simple variables', () => {
    const result = compileTemplate('Hello ${name}!', { name: 'World' } as never);

    expect(result).toBe('Hello World!');
  });

  it('should interpolate nested object properties', () => {
    const context = {
      nextRelease: {
        version: '1.2.3',
        gitTag: 'v1.2.3',
      },
    };

    const result = compileTemplate('Released ${nextRelease.version}', context as never);

    expect(result).toBe('Released 1.2.3');
  });

  it('should handle complex template expressions', () => {
    const context = {
      commits: [{ hash: 'abc123' }, { hash: 'def456' }],
    };

    const result = compileTemplate('Commits: ${commits.length}', context as never);

    expect(result).toBe('Commits: 2');
  });

  it('should return original string when template syntax is invalid', () => {
    const invalidTemplate = '<%= invalid syntax {{{}}}';

    const result = compileTemplate(invalidTemplate, {});

    expect(result).toBe(invalidTemplate);
  });

  it('should return original string when variable is undefined', () => {
    const template = 'Hello ${undefinedVar}!';

    const result = compileTemplate(template, {});

    // Lodash template throws on undefined variables, so original is returned
    expect(result).toBe(template);
  });
});

describe('evaluateCondition', () => {
  it('should return true for truthy template result', () => {
    const result = evaluateCondition('<%= true %>', {});

    expect(result).toBe(true);
  });

  it('should return false for falsy template result', () => {
    const result = evaluateCondition('<%= false %>', {});

    expect(result).toBe(false);
  });

  it('should return false for string "false"', () => {
    const result = evaluateCondition('<%= "false" %>', {});

    expect(result).toBe(false);
  });

  it('should return false for string "0"', () => {
    const result = evaluateCondition('<%= "0" %>', {});

    expect(result).toBe(false);
  });

  it('should return false for empty string result', () => {
    const result = evaluateCondition('<%= "" %>', {});

    expect(result).toBe(false);
  });

  it('should return true for non-empty string result', () => {
    const result = evaluateCondition('<%= "yes" %>', {});

    expect(result).toBe(true);
  });

  it('should evaluate conditions with context', () => {
    const context = {
      branch: { name: 'main', prerelease: false },
    };

    const result = evaluateCondition('<%= branch.name === "main" %>', context as never);

    expect(result).toBe(true);
  });

  it('should return true (default) when template evaluation fails', () => {
    const invalidTemplate = '<%= this.will.throw.an.error() %>';

    const result = evaluateCondition(invalidTemplate, {});

    expect(result).toBe(true);
  });
});
