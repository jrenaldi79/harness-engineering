#!/usr/bin/env node

/**
 * Legacy documentation helper exports; CLI delegates to the canonical capability.
 *
 * Two modes:
 * - Default (write): Refreshes configured inventories and index, never stages.
 * - --check: Read-only validation of all generated output.
 *
 * Usage:
 *   node scripts/generate-docs.js          # Refresh mode (review/stage explicitly)
 *   node scripts/generate-docs.js --check  # Check mode (validate only)
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  buildDirectoryTree,
  detectSourceDirs,
  buildModuleIndex,
} = require('./generate-docs-helpers');

// ---------------------------------------------------------------------------
// Marker Replacement
// ---------------------------------------------------------------------------

/**
 * Replace content between AUTO markers in a document.
 * Markers: `<!-- AUTO:name -->` ... `<!-- /AUTO:name -->`
 * @param {string} content - Full document content
 * @param {string} markerName - Marker identifier
 * @param {string} newContent - Replacement content
 * @returns {string} Updated document
 */
function replaceMarkers(content, markerName, newContent) {
  const open = `<!-- AUTO:${markerName} -->`;
  const close = `<!-- /AUTO:${markerName} -->`;
  const openIdx = content.indexOf(open);
  const closeIdx = content.indexOf(close);

  if (openIdx === -1 || closeIdx === -1) {
    return content;
  }

  const before = content.slice(0, openIdx + open.length);
  const after = content.slice(closeIdx);
  return `${before}\n${newContent}\n${after}`;
}

// ---------------------------------------------------------------------------
// Cross-Link Validation
// ---------------------------------------------------------------------------

/**
 * Validate that markdown cross-links point to existing files.
 * Skips http/https URLs and anchor-only links.
 * @param {string} markdown - Markdown content
 * @param {string} rootDir - Project root for resolving relative paths
 * @returns {string[]} Array of error messages for broken links
 */
function validateCrossLinks(markdown, rootDir) {
  const errors = [];
  const linkRe = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkRe.exec(markdown)) !== null) {
    const target = match[2];
    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('#')) {
      continue;
    }
    const filePart = target.split('#')[0];
    if (!filePart) {
      continue;
    }
    const resolved = path.resolve(rootDir, filePart);
    if (!fs.existsSync(resolved)) {
      errors.push(`Broken link: [${match[1]}](${target}) -> ${filePart} not found`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Plans Index Builder
// ---------------------------------------------------------------------------

/**
 * Generate a markdown index of all docs/ content.
 * Scans docs/ recursively, groups by subdirectory, extracts headings.
 * @param {string} rootDir - Project root directory
 * @returns {string} Markdown index content
 */
function buildDocsIndex(rootDir) {
  const docsDir = path.join(rootDir, 'docs');
  const rootFiles = [];
  const subdirs = {};
  collectDocsRecursive(docsDir, '', rootFiles, subdirs);

  if (rootFiles.length === 0 && Object.keys(subdirs).length === 0) {
    return 'No documentation files found.';
  }

  const sections = [];
  if (rootFiles.length > 0) {
    for (const f of rootFiles) {
      sections.push(formatDocEntry(f.name, f.heading, `docs/${f.name}`));
    }
  }
  for (const [dir, files] of Object.entries(subdirs).sort()) {
    if (sections.length > 0) sections.push('');
    sections.push(`## ${dir}\n`);
    for (const f of files) {
      sections.push(formatDocEntry(f.name, f.heading, `docs/${dir}/${f.name}`));
    }
  }
  return sections.join('\n');
}

function formatDocEntry(name, heading, linkPath) {
  return heading ? `- [${name}](${linkPath}) — ${heading}` : `- [${name}](${linkPath})`;
}

function collectDocsRecursive(dirPath, relPrefix, rootFiles, subdirs) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }
  const dirs = entries.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  const files = entries
    .filter(e => e.isFile() && e.name.endsWith('.md') && e.name !== 'index.md')
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const file of files) {
    const heading = extractFirstHeading(path.join(dirPath, file.name));
    const entry = { name: file.name, heading };
    if (relPrefix) {
      if (!subdirs[relPrefix]) subdirs[relPrefix] = [];
      subdirs[relPrefix].push(entry);
    } else {
      rootFiles.push(entry);
    }
  }
  for (const dir of dirs) {
    const nextPrefix = relPrefix ? `${relPrefix}/${dir.name}` : dir.name;
    collectDocsRecursive(path.join(dirPath, dir.name), nextPrefix, rootFiles, subdirs);
  }
}

function extractFirstHeading(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^#\s+(.+)/m);
    return match ? match[1].trim() : '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Staleness Check
// ---------------------------------------------------------------------------

/**
 * Compare current marker content against freshly generated content.
 * @param {string} docContent - Current document content
 * @param {Object<string, string>} generated - Map of markerName -> generated content
 * @returns {string[]} Names of stale markers
 */
function checkMarkersAreCurrent(docContent, generated) {
  const stale = [];
  for (const [name, expected] of Object.entries(generated)) {
    const open = `<!-- AUTO:${name} -->`;
    const close = `<!-- /AUTO:${name} -->`;
    const openIdx = docContent.indexOf(open);
    const closeIdx = docContent.indexOf(close);

    if (openIdx === -1 || closeIdx === -1) {
      stale.push(name);
      continue;
    }
    const current = docContent.slice(openIdx + open.length, closeIdx).trim();
    if (current !== expected.trim()) {
      stale.push(name);
    }
  }
  return stale;
}

// ---------------------------------------------------------------------------
// Canonical CLI; exports below remain for legacy helper consumers.
if (require.main === module) {
  const {cli} = require('../../../../plugins/documentation/skills/documentation/scripts/generate');
  try { cli(process.argv.slice(2)); }
  catch(error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = {
  replaceMarkers,
  validateCrossLinks,
  buildDocsIndex,
  checkMarkersAreCurrent,
};
