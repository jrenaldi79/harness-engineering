/**
 * Tests for skills/setup/scripts/lib/check-file-sizes.js
 *
 * Validates checkFileSize, checkFiles, and matchesPattern functions
 * that enforce the 300-line limit on source files.
 */

'use strict';

const { checkFileSize, checkFiles, matchesPattern } = require('../../skills/setup/scripts/lib/check-file-sizes');

// ---------------------------------------------------------------------------
// checkFileSize
// ---------------------------------------------------------------------------
describe('checkFileSize', () => {
  it('returns null for files under the limit', () => {
    const content = 'line1\nline2\nline3\n';
    expect(checkFileSize(content, 'src/small.js', 300)).toBeNull();
  });

  it('returns null for files exactly at the limit', () => {
    const content = Array(300).fill('x').join('\n') + '\n';
    expect(checkFileSize(content, 'src/exact.js', 300)).toBeNull();
  });

  it('returns violation for files over the limit', () => {
    const content = Array(301).fill('x').join('\n') + '\n';
    const result = checkFileSize(content, 'src/big.js', 300);
    expect(result).toEqual({ file: 'src/big.js', lines: 301, limit: 300 });
  });

  it('handles trailing newline correctly', () => {
    // 3 lines with trailing newline = "a\nb\nc\n" -> split produces 4 elements, adjusted to 3
    const withNewline = 'a\nb\nc\n';
    expect(checkFileSize(withNewline, 'f.js', 3)).toBeNull();

    // 4 lines without trailing newline = "a\nb\nc\nd" -> split produces 4, no adjustment
    const withoutNewline = 'a\nb\nc\nd';
    expect(checkFileSize(withoutNewline, 'f.js', 3)).toEqual({
      file: 'f.js', lines: 4, limit: 3,
    });
  });

  it('handles empty content', () => {
    expect(checkFileSize('', 'empty.js', 300)).toBeNull();
  });

  it('handles single-line file', () => {
    expect(checkFileSize('one line\n', 'one.js', 1)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkFiles
// ---------------------------------------------------------------------------
describe('checkFiles', () => {
  it('returns violations for files exceeding the limit', () => {
    const files = [
      { path: 'a.js', content: Array(100).fill('x').join('\n') + '\n' },
      { path: 'b.js', content: Array(400).fill('x').join('\n') + '\n' },
      { path: 'c.js', content: Array(50).fill('x').join('\n') + '\n' },
    ];
    const violations = checkFiles(files, 300);
    expect(violations).toHaveLength(1);
    expect(violations[0].file).toBe('b.js');
    expect(violations[0].lines).toBe(400);
  });

  it('returns empty array when all files are within limit', () => {
    const files = [
      { path: 'a.js', content: 'short\n' },
      { path: 'b.js', content: 'also short\n' },
    ];
    expect(checkFiles(files, 300)).toHaveLength(0);
  });

  it('returns multiple violations', () => {
    const files = [
      { path: 'a.js', content: Array(400).fill('x').join('\n') + '\n' },
      { path: 'b.js', content: Array(500).fill('x').join('\n') + '\n' },
    ];
    const violations = checkFiles(files, 300);
    expect(violations).toHaveLength(2);
  });

  it('handles empty file list', () => {
    expect(checkFiles([], 300)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// matchesPattern
// ---------------------------------------------------------------------------
describe('matchesPattern', () => {
  it('matches files directly in src/ with ** glob', () => {
    expect(matchesPattern('src/foo.js', ['src/**/*.js'])).toBe(true);
  });

  it('matches nested paths with **', () => {
    expect(matchesPattern('src/deep/nested/file.js', ['src/**/*.js'])).toBe(true);
  });

  it('matches one-level deep subdirectory', () => {
    expect(matchesPattern('src/sub/foo.js', ['src/**/*.js'])).toBe(true);
  });

  it('does not match files outside pattern', () => {
    expect(matchesPattern('lib/sub/foo.js', ['src/**/*.js'])).toBe(false);
  });

  it('does not match wrong extension', () => {
    expect(matchesPattern('src/sub/foo.ts', ['src/**/*.js'])).toBe(false);
  });

  it('matches single * for non-recursive glob', () => {
    expect(matchesPattern('src/foo.js', ['src/*.js'])).toBe(true);
    expect(matchesPattern('src/sub/foo.js', ['src/*.js'])).toBe(false);
  });

  it('returns false for empty patterns', () => {
    expect(matchesPattern('src/foo.js', [])).toBe(false);
  });
});
