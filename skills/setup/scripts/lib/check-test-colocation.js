#!/usr/bin/env node

/**
 * Test colocation enforcement script for pre-commit hook.
 * Blocks commits containing source files in src/ that lack a matching test file.
 *
 * Usage:
 *   node scripts/check-test-colocation.js          # Scans git staged files
 *   const { checkColocation } = require('./scripts/check-test-colocation');  # Library use
 */

const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { resolve, dirname, basename, extname } = require('node:path');

const CONFIG = {
  include: ['src/**/*.ts', 'src/**/*.js'],
  exclude: ['src/**/*.test.*', 'src/**/*.spec.*', 'src/**/*.d.ts', 'src/**/index.ts', 'src/**/index.js'],
  testSuffixes: ['.test', '.spec'],
};

/**
 * Simple glob match for include/exclude patterns.
 * @param {string} filePath
 * @param {string[]} patterns
 * @returns {boolean}
 */
function matchesPattern(filePath, patterns) {
  for (const pattern of patterns) {
    const regexStr = pattern
      .replace(/\*\*\//g, '<<GLOBSTAR_SEP>>')
      .replace(/\*\*/g, '<<GLOBSTAR>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<GLOBSTAR_SEP>>/g, '(.*/)?')
      .replace(/<<GLOBSTAR>>/g, '.*');
    if (new RegExp(`^${regexStr}$`).test(filePath)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a source file has a colocated test file.
 * @param {string} filePath - Source file path (e.g., src/users/service.ts)
 * @returns {null | {file: string, expected: string[]}}
 */
function checkColocation(filePath) {
  const dir = dirname(filePath);
  const ext = extname(filePath);
  const name = basename(filePath, ext);

  const candidates = CONFIG.testSuffixes.map(suffix =>
    resolve(dir, `${name}${suffix}${ext}`)
  );

  const hasTest = candidates.some(candidate => existsSync(candidate));
  if (!hasTest) {
    return { file: filePath, expected: candidates.map(c => c.replace(resolve('.') + '/', '')) };
  }
  return null;
}

/**
 * Main: scan git staged files for missing colocated tests.
 * Exit 1 if any source file lacks a test.
 */
function main() {
  let stagedFiles;
  try {
    const output = execFileSync(
      'git',
      ['diff', '--cached', '--name-only', '--diff-filter=ACM'],
      { encoding: 'utf-8' }
    );
    stagedFiles = output.trim().split('\n').filter(Boolean);
  } catch {
    console.error('Failed to get staged files.');
    process.exit(1);
  }

  const sourceFiles = stagedFiles.filter(f =>
    matchesPattern(f, CONFIG.include) && !matchesPattern(f, CONFIG.exclude)
  );

  if (sourceFiles.length === 0) {
    process.exit(0);
  }

  const violations = [];
  for (const f of sourceFiles) {
    const result = checkColocation(f);
    if (result) {
      violations.push(result);
    }
  }

  if (violations.length > 0) {
    console.error('\n  BLOCKED: Source files missing colocated tests:');
    for (const v of violations) {
      console.error(`    ${v.file}`);
      console.error(`      Expected: ${v.expected[0]} or ${v.expected[1]}`);
    }
    console.error('\n  Write tests before committing. TDD: Red → Green → Refactor.\n');
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].includes('check-test-colocation')) {
  main();
}

module.exports = { checkColocation, matchesPattern };
