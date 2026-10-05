/**
 * Copies enforcement tooling into a target project.
 *
 * Usage:
 *   node install-enforcement.js --target=<project-root> [--framework=<fw>] [--skip-install]
 *
 * Actions:
 *   1. Creates scripts/ and .husky/ in target if needed
 *   2. Copies 6 enforcement scripts (skip if already exists)
 *   3. Preserves existing hooks and initializes Husky after dependency installation
 *   4. Copies hooks → .husky/ (chmod 755)
 *   5. Copies configs with eslint rename
 *   6. Copies .claude/settings.json (skip if exists)
 *   7. Copies .claude/rules/*.md path-scoped rules (skip if exists)
 *   8. Handles .gitignore (create or append)
 *   9. Copies .env.example (skip if exists)
 *  10. Merges npm scripts into package.json
 *  11. Adds lint-staged config to package.json
 *  12. Installs dev deps (unless --skip-install)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = { target: null, skipInstall: false, framework: 'none' };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--target=')) flags.target = arg.slice('--target='.length);
    else if (arg.startsWith('--framework=')) flags.framework = arg.slice('--framework='.length);
    else if (arg === '--skip-install') flags.skipInstall = true;
  }
  if (!flags.target) {
    console.error('Error: --target=<project-root> is required');
    process.exit(1);
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function copyIfAbsent(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
  }
}

function run(cmd, args, cwd) {
  childProcess.execFileSync(cmd, args, { cwd, stdio: 'ignore' });
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

const LIB_DIR = path.join(__dirname, 'lib');
const HOOKS_DIR = path.join(__dirname, 'hooks');
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

const ENFORCEMENT_SCRIPTS = [
  'check-secrets.js',
  'check-file-sizes.js',
  'check-test-colocation.js',
  'validate-docs.js',
];

const HOOKS = ['pre-commit', 'pre-push'];

const SETTINGS_TEMPLATE = 'settings.json';

const NPM_SCRIPTS = {
  prepare: 'husky',
  test: 'jest',
  'test:all': 'jest --testPathPattern="\\.(test|integration\\.test)\\.[jt]s$"',
  posttest: 'git rev-parse HEAD > .test-passed',
  'validate-docs': 'node scripts/validate-docs.js --full',
  'generate-docs': 'node scripts/generate-docs.js',
  lint: 'eslint src/',
};

const LINT_STAGED_CONFIG = { 'src/**/*.js': ['eslint --fix'] };

function copyEnforcementScripts(targetDir) {
  const scriptsDir = path.join(targetDir, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });
  for (const file of ENFORCEMENT_SCRIPTS) {
    copyIfAbsent(path.join(LIB_DIR, file), path.join(scriptsDir, file));
  }
}

function copyHooks(targetDir) {
  const huskyDir = path.join(targetDir, '.husky');
  fs.mkdirSync(huskyDir, { recursive: true });
  for (const hook of HOOKS) {
    const dest = path.join(huskyDir, hook);
    copyIfAbsent(path.join(HOOKS_DIR, hook), dest);
    fs.chmodSync(dest, 0o755);
  }
}

function copyConfigs(targetDir) {
  fs.copyFileSync(
    path.join(TEMPLATES_DIR, 'eslint-base.js'),
    path.join(targetDir, '.eslintrc.js')
  );
  copyIfAbsent(path.join(TEMPLATES_DIR, '.prettierrc'), path.join(targetDir, '.prettierrc'));
  copyIfAbsent(
    path.join(TEMPLATES_DIR, 'lint-staged.config.js'),
    path.join(targetDir, 'lint-staged.config.js')
  );
}

function copySettings(targetDir) {
  const claudeDir = path.join(targetDir, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  copyIfAbsent(
    path.join(TEMPLATES_DIR, SETTINGS_TEMPLATE),
    path.join(claudeDir, 'settings.json')
  );
}

const REACT_FRAMEWORKS = new Set(['vite', 'nextjs']);

function copyRules(targetDir, framework) {
  const rulesSourceDir = path.join(TEMPLATES_DIR, 'rules');
  const rulesDestDir = path.join(targetDir, '.claude', 'rules');
  fs.mkdirSync(rulesDestDir, { recursive: true });
  const ruleFiles = fs.readdirSync(rulesSourceDir).filter(f => f.endsWith('.md'));
  for (const file of ruleFiles) {
    // Only copy react.md for React-based frameworks (vite, nextjs)
    if (file === 'react.md' && !REACT_FRAMEWORKS.has(framework)) continue;
    copyIfAbsent(path.join(rulesSourceDir, file), path.join(rulesDestDir, file));
  }
}

function handleGitignore(targetDir) {
  const src = path.join(TEMPLATES_DIR, 'gitignore-template');
  const dest = path.join(targetDir, '.gitignore');
  const ourPatterns = fs.readFileSync(src, 'utf8');

  if (!fs.existsSync(dest)) {
    fs.writeFileSync(dest, ourPatterns);
  } else {
    const existing = fs.readFileSync(dest, 'utf8');
    const separator = existing.endsWith('\n') ? '\n' : '\n\n';
    fs.writeFileSync(dest, existing + separator + '# harness-engineering enforcement\n' + ourPatterns);
  }
}

function mergePackageJson(targetDir) {
  const pkgPath = path.join(targetDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // Merge scripts (no overwrite)
  pkg.scripts = pkg.scripts || {};
  for (const [key, value] of Object.entries(NPM_SCRIPTS)) {
    if (!pkg.scripts[key]) pkg.scripts[key] = value;
  }

  // Add lint-staged config if absent
  if (!pkg['lint-staged']) {
    pkg['lint-staged'] = LINT_STAGED_CONFIG;
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const flags = parseArgs(process.argv);
  const targetDir = path.resolve(flags.target);

  installDocumentation(targetDir);

  copyEnforcementScripts(targetDir);

  copyHooks(targetDir);
  copyConfigs(targetDir);
  copySettings(targetDir);
  copyRules(targetDir, flags.framework);
  handleGitignore(targetDir);
  copyIfAbsent(path.join(TEMPLATES_DIR, '.env.example'), path.join(targetDir, '.env.example'));
  mergePackageJson(targetDir);

  if (!flags.skipInstall) {
    run('npm', ['install', '--save-dev', 'husky', 'lint-staged', 'jest', 'eslint'], targetDir);
    run('npx', ['husky'], targetDir);
  }

  console.log('Enforcement tooling installed into ' + targetDir);
}

main();

/** Reuse the self-contained capability; target projects receive one engine. */
function installDocumentation(targetDir) {
  const {install} = require('../../../plugins/documentation/skills/documentation/scripts/install');
  const {working} = require('../../../plugins/documentation/skills/documentation/scripts/filesystem');
  working(targetDir).validatePath('scripts/generate-docs.js');
  const wrapper = '#!/usr/bin/env node\n' +
    "// harness documentation compatibility launcher\n" +
    "const {cli} = require('./self-documentation/generate');\n" +
    "try { cli(['--root=' + require('node:path').resolve(__dirname, '..'), ...process.argv.slice(2)]); }\n" +
    "catch (error) { console.error(error.message); process.exitCode = 1; }\n";
  const wrapperPath = path.join(targetDir, 'scripts', 'generate-docs.js');
  if (fs.existsSync(wrapperPath)) {
    const existing = fs.readFileSync(wrapperPath, 'utf8').replace(/\r\n/g, '\n');
    if (existing !== wrapper) {
      throw new Error('Existing scripts/generate-docs.js requires explicit migration; preserve it and use the documentation-only installer.');
    }
  }
  install(targetDir, {createInstruction: false, refresh: false});
  fs.writeFileSync(wrapperPath, wrapper);
}
