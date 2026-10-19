/**
 * Installs Python enforcement into a project with a pyproject.toml.
 *
 * Usage:
 *   node install-python.js --target=<project-root> [--size-policy=ratchet|cap] [--folder-notes] [--skip-install]
 *
 * Actions (existing files are never overwritten):
 *   1. Copies stdlib checks to scripts/checks/ and their pytest suites to tests/; adds "." to
 *      pytest's pythonpath in pyproject.toml so those tests can import scripts.checks
 *   2. Writes scripts/checks/config.json: line limit, size policy, testMap for the detected layout
 *   3. Writes .githooks/pre-commit and pre-push (uv-aware) and sets core.hooksPath unless another
 *      hooks manager already owns it
 *   4. Copies .claude/settings.json and the Python .claude/rules/*.md
 *   5. Adds missing Python patterns to .gitignore
 *   6. Installs the documentation engine over the source roots; --folder-notes turns notes on
 *   7. Adds pytest and ruff as uv dev dependencies (unless --skip-install)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const TEMPLATES = path.join(__dirname, '..', 'templates', 'python');
const DOCS_SCRIPTS = path.join(__dirname, '../../../plugins/documentation/skills/documentation/scripts');
const SIZE_POLICIES = ['ratchet', 'cap'];
const NOT_PACKAGES = new Set(['tests', 'test', 'scripts', 'docs', 'build', 'dist', 'node_modules']);
const TEST_PATTERN = 'tests/*test_{stem}*.py';

function parseArgs(argv) {
  const flags = { target: null, skipInstall: false, folderNotes: false, sizePolicy: 'ratchet' };
  for (const arg of argv) {
    if (arg.startsWith('--target=')) flags.target = arg.slice('--target='.length);
    else if (arg.startsWith('--size-policy=')) flags.sizePolicy = arg.slice('--size-policy='.length);
    else if (arg === '--skip-install') flags.skipInstall = true;
    else if (arg === '--folder-notes') flags.folderNotes = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!flags.target) throw new Error('--target=<project-root> is required');
  if (!SIZE_POLICIES.includes(flags.sizePolicy)) throw new Error('--size-policy must be ratchet or cap');
  return flags;
}

function writeIfAbsent(dest, content, mode) {
  if (fs.existsSync(dest)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  if (mode) fs.chmodSync(dest, mode);
}

function copyDir(srcDir, destDir) {
  for (const file of fs.readdirSync(srcDir)) {
    writeIfAbsent(path.join(destDir, file), fs.readFileSync(path.join(srcDir, file)));
  }
}

/** src layout when src/ exists; otherwise the top-level packages (folders with __init__.py). */
function sourceDirs(root) {
  if (fs.existsSync(path.join(root, 'src'))) return ['src'];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && !NOT_PACKAGES.has(entry.name))
    .filter(entry => fs.existsSync(path.join(root, entry.name, '__init__.py')))
    .map(entry => entry.name)
    .sort();
}

function usesUv(root) {
  if (fs.existsSync(path.join(root, 'uv.lock'))) return true;
  return /^\[tool\.uv\]/m.test(fs.readFileSync(path.join(root, 'pyproject.toml'), 'utf8'));
}

function installChecks(root, flags, dirs) {
  copyDir(path.join(TEMPLATES, 'checks'), path.join(root, 'scripts', 'checks'));
  copyDir(path.join(TEMPLATES, 'tests'), path.join(root, 'tests'));
  const config = {
    limit: 300,
    sizePolicy: flags.sizePolicy,
    sizeSkip: [],
    testMap: dirs.map(dir => ({ dir, pattern: TEST_PATTERN })),
  };
  writeIfAbsent(path.join(root, 'scripts', 'checks', 'config.json'), JSON.stringify(config, null, 2) + '\n');
}

/** The shipped tests import `scripts.checks`, so pytest needs the project root on its path. */
function ensurePytestPath(root) {
  const file = path.join(root, 'pyproject.toml');
  const text = fs.readFileSync(file, 'utf8');
  if (/^\s*pythonpath\s*=/m.test(text)) {
    return /^\s*pythonpath\s*=.*["']\.["']/m.test(text) ? null
      : 'Add "." to pythonpath under [tool.pytest.ini_options] so tests can import scripts.checks.';
  }
  const header = /^\[tool\.pytest\.ini_options\][ \t]*\r?\n/m;
  const updated = header.test(text)
    ? text.replace(header, match => `${match}pythonpath = ["."]\n`)
    : `${text}${text.endsWith('\n') ? '' : '\n'}\n[tool.pytest.ini_options]\npythonpath = ["."]\n`;
  fs.writeFileSync(file, updated);
  return null;
}

function installHooks(root) {
  const run = usesUv(root) ? 'uv run --quiet' : '';
  for (const hook of ['pre-commit', 'pre-push']) {
    const content = fs.readFileSync(path.join(TEMPLATES, 'githooks', hook), 'utf8').replace('{{RUN}}', run);
    writeIfAbsent(path.join(root, '.githooks', hook), content, 0o755);
  }
  if (spawnSync('git', ['rev-parse', '--git-dir'], { cwd: root }).status !== 0) {
    return 'Not a git repository: run `git init`, then `git config core.hooksPath .githooks`.';
  }
  const current = spawnSync('git', ['config', 'core.hooksPath'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  if (current && current !== '.githooks') {
    return `core.hooksPath is already "${current}"; call .githooks/pre-commit and pre-push from it.`;
  }
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: root });
  return null;
}

function installAgentConfig(root) {
  writeIfAbsent(path.join(root, '.claude', 'settings.json'), fs.readFileSync(path.join(TEMPLATES, 'settings.json')));
  copyDir(path.join(TEMPLATES, 'rules'), path.join(root, '.claude', 'rules'));
}

function mergeGitignore(root) {
  const dest = path.join(root, '.gitignore');
  const existing = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : '';
  const present = new Set(existing.split(/\r?\n/).map(line => line.trim()));
  const missing = fs.readFileSync(path.join(TEMPLATES, 'gitignore-template'), 'utf8')
    .split('\n').filter(line => line && !present.has(line));
  if (missing.length === 0) return;
  const separator = existing === '' || existing.endsWith('\n') ? '' : '\n';
  fs.writeFileSync(dest, existing + separator + missing.join('\n') + '\n');
}

/** Notes are switched on after install, so a project can list the notes it still has to write. */
function installDocumentation(root, dirs, folderNotes) {
  const { install } = require(path.join(DOCS_SCRIPTS, 'install'));
  install(root, {
    createInstruction: false,
    refresh: false,
    sources: [...dirs, 'scripts'].join(','),
    exclude: 'scripts/self-documentation',
  });
  if (!folderNotes) return null;
  const configPath = path.join(root, 'documentation.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  fs.writeFileSync(configPath, JSON.stringify({ ...config, folderNotes: true }, null, 2) + '\n');
  return 'Folder notes are on: write a CLAUDE.md note in every source folder, then run ' +
    '`node scripts/self-documentation/generate.js` (it lists any that are missing).';
}

function main(argv) {
  const flags = parseArgs(argv);
  const root = path.resolve(flags.target);
  if (!fs.existsSync(path.join(root, 'pyproject.toml'))) throw new Error(`No pyproject.toml in ${root}`);
  const dirs = sourceDirs(root);
  installChecks(root, flags, dirs);
  const notes = [ensurePytestPath(root), installHooks(root)];
  installAgentConfig(root);
  mergeGitignore(root);
  notes.push(installDocumentation(root, dirs, flags.folderNotes));
  if (!flags.skipInstall) {
    if (usesUv(root)) execFileSync('uv', ['add', '--dev', 'pytest', 'ruff'], { cwd: root, stdio: 'ignore' });
    else notes.push('Add pytest and ruff as development dependencies.');
  }
  console.log(`Python enforcement installed into ${root}`);
  for (const note of notes.filter(Boolean)) console.log(`- ${note}`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
