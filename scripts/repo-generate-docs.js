#!/usr/bin/env node

/**
 * Repo-level CLAUDE.md auto-generator.
 *
 * Regenerates AUTO:tree and AUTO:modules markers in the repo's CLAUDE.md
 * from the actual directory structure. Unlike the template generate-docs.js
 * (which targets user projects), this scans the repo's own layout:
 * skills/, scripts/, tests/, .claude/, .claude-plugin/.
 *
 * Usage:
 *   node scripts/repo-generate-docs.js               # Regenerate + auto-stage
 *   node scripts/repo-generate-docs.js --check        # Validate only, exit 1 if stale
 *   node scripts/repo-generate-docs.js --root <dir>   # Override root directory
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  buildDirectoryTree,
} = require('../skills/setup/scripts/lib/generate-docs-helpers');

const {
  replaceMarkers,
  checkMarkersAreCurrent,
} = require('../skills/setup/scripts/lib/generate-docs');

const REPO_TREE_DIRS = ['skills/', 'scripts/', 'tests/'];

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const checkMode = args.includes('--check');
const rootIdx = args.indexOf('--root');
const rootDir = rootIdx !== -1 ? path.resolve(args[rootIdx + 1]) : path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Module Index (repo-specific)
// ---------------------------------------------------------------------------

/** Scan known module locations and build a markdown table. */
function buildRepoModuleIndex(root) {
  const entries = [];

  collectSkillModules(root, entries);
  collectScriptModules(root, entries);
  collectEvalModules(root, entries);

  const header = '| Module | Purpose |';
  const sep = '|--------|---------|';
  const rows = entries.map(e => `| \`${e.path}\` | ${e.purpose} |`);
  return [header, sep, ...rows].join('\n');
}

function collectSkillModules(root, entries) {
  const skillsDir = path.join(root, 'skills');
  if (!fs.existsSync(skillsDir)) return;

  for (const skill of safeReaddir(skillsDir)) {
    const skillPath = path.join(skillsDir, skill);
    if (!fs.statSync(skillPath).isDirectory()) continue;

    const skillMd = path.join(skillPath, 'SKILL.md');
    if (fs.existsSync(skillMd)) {
      const desc = extractFirstHeading(skillMd) || `${skill} skill definition`;
      entries.push({ path: `skills/${skill}/SKILL.md`, purpose: desc });
    }

    collectJsFilesRecursive(skillPath, `skills/${skill}`, entries);
  }
}

function collectScriptModules(root, entries) {
  const scriptsDir = path.join(root, 'scripts');
  if (!fs.existsSync(scriptsDir)) return;

  for (const file of safeReaddir(scriptsDir)) {
    const full = path.join(scriptsDir, file);
    if (!fs.statSync(full).isFile()) continue;
    if (!file.endsWith('.js') && !file.endsWith('.sh')) continue;
    const desc = file.endsWith('.js') ? extractJsDocLine(full) : extractBashComment(full);
    entries.push({ path: `scripts/${file}`, purpose: desc || file });
  }
}

function collectEvalModules(root, entries) {
  const evalsDir = path.join(root, 'tests', 'evals');
  if (!fs.existsSync(evalsDir)) return;

  for (const file of safeReaddir(evalsDir)) {
    const full = path.join(evalsDir, file);
    if (!fs.statSync(full).isFile()) continue;
    if (!file.endsWith('.js') && !file.endsWith('.sh')) continue;
    const desc = file.endsWith('.js') ? extractJsDocLine(full) : extractBashComment(full);
    entries.push({ path: `tests/evals/${file}`, purpose: desc || file });
  }
}

function collectJsFilesRecursive(dir, relPrefix, entries) {
  const skip = new Set(['node_modules', '.git', 'fixtures', 'templates', 'references']);
  for (const entry of safeReaddir(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    const rel = `${relPrefix}/${entry}`;

    if (stat.isDirectory() && !skip.has(entry) && !entry.startsWith('.')) {
      collectJsFilesRecursive(full, rel, entries);
    } else if (stat.isFile() && entry.endsWith('.js')) {
      const desc = extractJsDocLine(full);
      entries.push({ path: rel, purpose: desc || entry });
    }
  }
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

function extractFirstHeading(mdPath) {
  try {
    const content = fs.readFileSync(mdPath, 'utf8');
    const match = content.match(/^#\s+(.+)/m);
    return match ? match[1].trim() : '';
  } catch { return ''; }
}

function extractJsDocLine(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // Try multi-line JSDoc first (file-level comments are usually multi-line)
    const multi = content.match(/\/\*\*\s*\n([\s\S]*?)\*\//);
    if (multi) {
      for (const line of multi[1].split('\n')) {
        const cleaned = line.replace(/^\s*\*\s?/, '').trim();
        if (cleaned && !cleaned.startsWith('@')) return cleaned;
      }
    }
    // Fall back to single-line JSDoc
    const single = content.match(/\/\*\*\s+(.+?)\s*\*\//);
    if (single) {
      const text = single[1].replace(/\s*\*\/$/, '').trim();
      if (!text.startsWith('@')) return text;
    }
    return '';
  } catch { return ''; }
}

function extractBashComment(filePath) {
  try {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      if (line.startsWith('#!')) continue;
      if (line.startsWith('#') && line.length > 2) {
        return line.replace(/^#+\s*/, '').trim();
      }
      if (line.trim() === '') continue;
      break;
    }
    return '';
  } catch { return ''; }
}

function safeReaddir(dir) {
  try { return fs.readdirSync(dir).sort(); }
  catch { return []; }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const docPath = path.join(rootDir, 'CLAUDE.md');
  const tree = buildDirectoryTree(rootDir, REPO_TREE_DIRS);
  const modules = buildRepoModuleIndex(rootDir);
  const generated = { tree, modules };

  if (checkMode) {
    let doc;
    try { doc = fs.readFileSync(docPath, 'utf8'); }
    catch { console.error('Cannot read CLAUDE.md'); process.exit(1); }

    const stale = checkMarkersAreCurrent(doc, generated);
    if (stale.length > 0) {
      console.error(`Stale AUTO markers: ${stale.join(', ')}`);
      console.error('Run: node scripts/repo-generate-docs.js');
      process.exit(1);
    }
    console.log('All AUTO markers are current.');
    return;
  }

  let doc;
  try { doc = fs.readFileSync(docPath, 'utf8'); }
  catch { console.error('Cannot read CLAUDE.md'); process.exit(1); }

  doc = replaceMarkers(doc, 'tree', tree);
  doc = replaceMarkers(doc, 'modules', modules);
  fs.writeFileSync(docPath, doc);

  try { execFileSync('git', ['add', docPath], { stdio: 'ignore' }); }
  catch { /* not in git repo */ }

  console.log('CLAUDE.md AUTO markers regenerated.');
}

if (require.main === module) {
  main();
}

module.exports = { buildRepoModuleIndex };
