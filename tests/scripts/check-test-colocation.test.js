/**
 * Tests for skills/setup/scripts/lib/check-test-colocation.js
 *
 * Validates checkColocation and matchesPattern functions
 * that enforce colocated test files alongside source files.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { checkColocation, matchesPattern } = require('../../skills/setup/scripts/lib/check-test-colocation');

let tmpDir;
let origCwd;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-coloc-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// matchesPattern
// ---------------------------------------------------------------------------
describe('matchesPattern', () => {
  // Note: the simple glob-to-regex implementation requires a directory separator
  // for **/ patterns. So src/**/*.ts matches src/sub/service.ts but not src/service.ts.

  it('matches nested src paths', () => {
    expect(matchesPattern('src/users/service.ts', ['src/**/*.ts'])).toBe(true);
  });

  it('does not match direct src/ children (glob limitation)', () => {
    expect(matchesPattern('src/service.ts', ['src/**/*.ts'])).toBe(false);
  });

  it('matches single * glob for direct children', () => {
    expect(matchesPattern('src/service.ts', ['src/*.ts'])).toBe(true);
  });

  it('matches nested exclude patterns for test files', () => {
    expect(matchesPattern('src/sub/service.test.ts', ['src/**/*.test.*'])).toBe(true);
  });

  it('matches nested exclude patterns for spec files', () => {
    expect(matchesPattern('src/sub/service.spec.js', ['src/**/*.spec.*'])).toBe(true);
  });

  it('matches nested index files', () => {
    expect(matchesPattern('src/users/index.ts', ['src/**/index.ts'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkColocation
// ---------------------------------------------------------------------------
describe('checkColocation', () => {
  it('returns null when .test file exists', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src/service.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'src/service.test.ts'), '');

    expect(checkColocation('src/service.ts')).toBeNull();
  });

  it('returns null when .spec file exists', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src/service.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'src/service.spec.ts'), '');

    expect(checkColocation('src/service.ts')).toBeNull();
  });

  it('returns violation when no test file exists', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src/service.ts'), '');

    const result = checkColocation('src/service.ts');
    expect(result).not.toBeNull();
    expect(result.file).toBe('src/service.ts');
    expect(result.expected).toHaveLength(2);
  });

  it('works with .js files', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src/utils.js'), '');
    fs.writeFileSync(path.join(tmpDir, 'src/utils.test.js'), '');

    expect(checkColocation('src/utils.js')).toBeNull();
  });

  it('checks nested directory paths', () => {
    fs.mkdirSync(path.join(tmpDir, 'src/users'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src/users/repo.ts'), '');

    const result = checkColocation('src/users/repo.ts');
    expect(result).not.toBeNull();
    expect(result.file).toBe('src/users/repo.ts');
  });

  it('returns null for nested path with test', () => {
    fs.mkdirSync(path.join(tmpDir, 'src/users'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src/users/repo.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'src/users/repo.test.ts'), '');

    expect(checkColocation('src/users/repo.ts')).toBeNull();
  });
});
