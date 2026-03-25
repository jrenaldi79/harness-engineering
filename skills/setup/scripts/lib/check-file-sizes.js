#!/usr/bin/env node

/**
 * File size enforcement script for pre-commit hook.
 * Blocks commits containing .js files in src/ that exceed the line limit.
 *
 * Usage:
 *   node scripts/check-file-sizes.js          # Scans git staged files
 *   const { checkFileSize } = require('./scripts/check-file-sizes');  # Library use
 */

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const CONFIG = {
  maxLines: 300,
  include: ['src/**/*.js'],
  exclude: [],
};

/**
 * Check if a single file exceeds the line limit.
 * @param {string} content - File content
 * @param {string} filePath - File path
 * @param {number} limit - Max lines allowed
 * @returns {null | {file: string, lines: number, limit: number}}
 */
function checkFileSize(content, filePath, limit) {
  const lineCount = content.split('\n').length;
  const adjustedCount = content.endsWith('\n') ? lineCount - 1 : lineCount;

  if (adjustedCount > limit) {
    return { file: filePath, lines: adjustedCount, limit };
  }
  return null;
}

/**
 * Check multiple files against the line limit.
 * @param {Array<{path: string, content: string}>} files
 * @param {number} limit
 * @returns {Array<{file: string, lines: number, limit: number}>}
 */
function checkFiles(files, limit) {
  const violations = [];
  for (const { path, content } of files) {
    const result = checkFileSize(content, path, limit);
    if (result) {
      violations.push(result);
    }
  }
  return violations;
}

/**
 * Simple glob match for include/exclude patterns.
 * @param {string} filePath - Path to check
 * @param {string[]} patterns - Glob patterns to match against
 * @returns {boolean} True if path matches any pattern
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
 * Main: scan git staged files.
 * Exit 1 if any file exceeds the limit.
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

  const targetFiles = stagedFiles.filter(f =>
    matchesPattern(f, CONFIG.include) && !matchesPattern(f, CONFIG.exclude)
  );

  if (targetFiles.length === 0) {
    process.exit(0);
  }

  const files = targetFiles.map(f => ({
    path: f,
    content: readFileSync(resolve(f), 'utf-8'),
  }));

  const violations = checkFiles(files, CONFIG.maxLines);

  if (violations.length > 0) {
    console.error(
      '\n  BLOCKED: File size limit exceeded (max %d lines):',
      CONFIG.maxLines
    );
    for (const v of violations) {
      console.error(`    ${v.file}: ${v.lines} lines (limit: ${v.limit})`);
    }
    console.error('\n  Refactor large files before committing.\n');
    process.exit(1);
  }
}

// Run main when invoked directly
if (process.argv[1] && process.argv[1].includes('check-file-sizes')) {
  main();
}

module.exports = { checkFileSize, checkFiles, matchesPattern };
