/**
 * Helper functions for generate-docs.js.
 *
 * Extracts JSDoc descriptions, export names, builds directory trees,
 * and collects module index data from source files.
 */

const fs = require('node:fs');
const path = require('node:path');

const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage', 'dist', 'build', 'fixtures', 'results']);

// ---------------------------------------------------------------------------
// JSDoc & Export Extraction
// ---------------------------------------------------------------------------

/**
 * Extract the first description line from a file's JSDoc comment.
 * @param {string} filePath - Absolute path to a .js file
 * @returns {string} Description text, or empty string
 */
function extractJSDocDescription(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }

  // Multi-line first (file-level JSDoc is usually multi-line): /** \n * desc \n */
  const multiLine = content.match(/\/\*\*\s*\n([\s\S]*?)\*\//);
  if (multiLine) {
    const lines = multiLine[1].split('\n');
    for (const line of lines) {
      const cleaned = line.replace(/^\s*\*\s?/, '').trim();
      if (cleaned && !cleaned.startsWith('@')) {
        return cleaned;
      }
    }
  }

  // Single-line fallback: /** desc */
  const singleLine = content.match(/\/\*\*\s+(.+?)\s*\*\//);
  if (singleLine) {
    const text = singleLine[1].replace(/\s*\*\/$/, '').trim();
    if (!text.startsWith('@')) return text;
  }
  return '';
}

/**
 * Extract exported names from a CommonJS module (capped at 5).
 * Reads `module.exports = { ... }` and `exports.name =` patterns.
 * @param {string} filePath - Absolute path to a .js file
 * @returns {string[]} Array of export names (max 5)
 */
function extractExports(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const names = new Set();

  // module.exports = { name1, name2, ... }
  const objMatch = content.match(/module\.exports\s*=\s*\{([^}]*)\}/s);
  if (objMatch) {
    const body = objMatch[1];
    const keyRe = /\b([a-zA-Z_$][\w$]*)\b(?:\s*[,:}\n]|\s*$)/g;
    let m;
    while ((m = keyRe.exec(body)) !== null) {
      names.add(m[1]);
    }
  }

  // exports.name = ...
  const namedRe = /exports\.([a-zA-Z_$][\w$]*)\s*=/g;
  let m;
  while ((m = namedRe.exec(content)) !== null) {
    names.add(m[1]);
  }

  return [...names].slice(0, 5);
}

// ---------------------------------------------------------------------------
// Directory Tree Builder
// ---------------------------------------------------------------------------

/**
 * Build an ASCII directory tree with JSDoc annotations.
 * @param {string} rootDir - Project root directory
 * @param {string[]} dirs - Top-level directories to include (e.g. ['src/', 'bin/'])
 * @returns {string} ASCII tree string
 */
function buildDirectoryTree(rootDir, dirs) {
  const lines = [];
  for (const dir of dirs) {
    const fullPath = path.join(rootDir, dir);
    if (!fs.existsSync(fullPath)) {
      continue;
    }
    lines.push(dir);
    buildTreeRecursive(fullPath, '', lines);
  }
  return lines.join('\n');
}

/**
 * Recursively build tree lines for a directory.
 * @param {string} dirPath - Directory to scan
 * @param {string} prefix - Line prefix for indentation
 * @param {string[]} lines - Accumulator for output lines
 */
function buildTreeRecursive(dirPath, prefix, lines) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  entries = entries.filter(e => {
    if (e.name.startsWith('.')) {
      return false;
    }
    if (e.isDirectory() && SKIP_DIRS.has(e.name)) {
      return false;
    }
    return true;
  });

  const sortedDirs = entries.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  const sortedFiles = entries.filter(e => e.isFile()).sort((a, b) => a.name.localeCompare(b.name));
  const sorted = [...sortedDirs, ...sortedFiles];

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const isLast = i === sorted.length - 1;
    const connector = isLast ? '\u2514\u2500\u2500 ' : '\u251c\u2500\u2500 ';
    const childPrefix = isLast ? '    ' : '\u2502   ';

    if (entry.isDirectory()) {
      lines.push(`${prefix}${connector}${entry.name}/`);
      buildTreeRecursive(path.join(dirPath, entry.name), prefix + childPrefix, lines);
    } else {
      let annotation = '';
      if (entry.name.endsWith('.js')) {
        const desc = extractJSDocDescription(path.join(dirPath, entry.name));
        if (desc) {
          annotation = `  # ${desc}`;
        }
      }
      lines.push(`${prefix}${connector}${entry.name}${annotation}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Source Directory Detection
// ---------------------------------------------------------------------------

const KNOWN_SOURCE_DIRS = new Set([
  'src', 'lib', 'app', 'apps', 'packages', 'services', 'modules',
  'cmd', 'internal', 'pkg', 'bin', 'components',
  'scripts', 'tests', 'test', 'spec',
]);

const SOURCE_EXTENSIONS = new Set([
  '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.c', '.cpp', '.h', '.hpp',
  '.java', '.kt', '.rb', '.php', '.swift', '.cs',
]);

/**
 * Detect source directories in a project by name and content.
 * @param {string} rootDir - Project root directory
 * @returns {string[]} Array of directory names with trailing slash
 */
function detectSourceDirs(rootDir) {
  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) {
      continue;
    }
    if (KNOWN_SOURCE_DIRS.has(entry.name)) {
      if (dirHasFiles(path.join(rootDir, entry.name), false)) {
        dirs.push(`${entry.name}/`);
      }
      continue;
    }
    if (dirHasFiles(path.join(rootDir, entry.name), true)) {
      dirs.push(`${entry.name}/`);
    }
  }
  return dirs.sort();
}

function dirHasFiles(dirPath, sourceOnly) {
  try {
    for (const e of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (e.isFile()) {
        if (!sourceOnly) return true;
        if (SOURCE_EXTENSIONS.has(path.extname(e.name).toLowerCase())) return true;
      }
      if (e.isDirectory() && !SKIP_DIRS.has(e.name) && dirHasFiles(path.join(dirPath, e.name), sourceOnly)) {
        return true;
      }
    }
  } catch { /* empty */ }
  return false;
}

// ---------------------------------------------------------------------------
// Module Index Builder
// ---------------------------------------------------------------------------

/**
 * Build a markdown table of modules from all detected source directories.
 * @param {string} rootDir - Project root directory
 * @returns {string} Markdown table
 */
function buildModuleIndex(rootDir) {
  const sourceDirs = detectSourceDirs(rootDir);
  const rows = [];
  for (const dir of sourceDirs) {
    const dirName = dir.replace(/\/$/, '');
    const fullPath = path.join(rootDir, dirName);
    collectModules(fullPath, rows, dirName);
  }

  const header = '| Module | Purpose | Key Exports |';
  const sep = '|--------|---------|-------------|';
  const dataRows = rows.map(r => `| \`${r.module}\` | ${r.purpose} | ${r.exports} |`);
  return [header, sep, ...dataRows].join('\n');
}

/**
 * Recursively collect module info from a directory.
 * @param {string} dirPath - Directory to scan
 * @param {Array<{module: string, purpose: string, exports: string}>} rows
 * @param {string} [relPrefix=''] - Relative path prefix
 */
function collectModules(dirPath, rows, relPrefix = '') {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  const sortedDirs = entries.filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name));
  const sortedFiles = entries.filter(e => e.isFile() && e.name.endsWith('.js'))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const file of sortedFiles) {
    const fullPath = path.join(dirPath, file.name);
    const modulePath = relPrefix ? `${relPrefix}/${file.name}` : file.name;
    const desc = extractJSDocDescription(fullPath);
    const exps = extractExports(fullPath);
    rows.push({
      module: modulePath,
      purpose: desc || '',
      exports: exps.map(e => `\`${e}()\``).join(', '),
    });
  }

  for (const dir of sortedDirs) {
    collectModules(path.join(dirPath, dir.name), rows, relPrefix ? `${relPrefix}/${dir.name}` : dir.name);
  }
}

module.exports = {
  SKIP_DIRS,
  extractJSDocDescription,
  extractExports,
  buildDirectoryTree,
  detectSourceDirs,
  buildModuleIndex,
};
