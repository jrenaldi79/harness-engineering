/**
 * Tests for skills/setup/scripts/install-enforcement.js
 *
 * Uses a temp directory per test and the --skip-install flag to avoid
 * running npm install or npx husky during testing.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../../skills/setup/scripts/install-enforcement.js');

/** Run install-enforcement.js as a child process with given args. */
function runScript(args, cwd) {
  return execFileSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-enf-'));
  // Create a minimal package.json in target
  fs.writeFileSync(
    path.join(tmpDir, 'package.json'),
    JSON.stringify({ name: 'test-project', version: '1.0.0', scripts: {}, devDependencies: {} }, null, 2) + '\n'
  );
  // Manually create .husky dir so hook copy works without running husky init
  fs.mkdirSync(path.join(tmpDir, '.husky'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Enforcement scripts
// ---------------------------------------------------------------------------
describe('enforcement scripts', () => {
  it('copies all 6 enforcement scripts to target scripts/', () => {
    runScript([`--target=${tmpDir}`, '--skip-install'], tmpDir);

    const scripts = [
      'check-secrets.js',
      'check-file-sizes.js',
      'check-test-colocation.js',
      'validate-docs.js',
      'generate-docs.js',
      'generate-docs-helpers.js',
    ];
    for (const file of scripts) {
      expect(fs.existsSync(path.join(tmpDir, 'scripts', file))).toBe(true);
    }
  });

  it('does not overwrite existing scripts in target scripts/', () => {
    // Pre-create one script with custom content
    fs.mkdirSync(path.join(tmpDir, 'scripts'), { recursive: true });
    const existing = path.join(tmpDir, 'scripts', 'check-secrets.js');
    fs.writeFileSync(existing, '// my custom version\n');

    runScript([`--target=${tmpDir}`, '--skip-install'], tmpDir);

    const content = fs.readFileSync(existing, 'utf8');
    expect(content).toBe('// my custom version\n');
  });

  it('creates scripts/ directory if it does not exist', () => {
    // tmpDir has no scripts/ dir by default
    runScript([`--target=${tmpDir}`, '--skip-install'], tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'scripts'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
describe('hooks', () => {
  it('copies hooks to .husky/ with execute permissions', () => {
    runScript([`--target=${tmpDir}`, '--skip-install'], tmpDir);

    const hooks = ['pre-commit', 'pre-push'];
    for (const hook of hooks) {
      const hookPath = path.join(tmpDir, '.husky', hook);
      expect(fs.existsSync(hookPath)).toBe(true);
      // Check executable bit: mode & 0o111 should be non-zero
      const stat = fs.statSync(hookPath);
      expect(stat.mode & 0o111).not.toBe(0);
    }
  });

  it('creates .husky/ directory if it does not exist', () => {
    // Remove the pre-created .husky dir
    fs.rmSync(path.join(tmpDir, '.husky'), { recursive: true, force: true });

    runScript([`--target=${tmpDir}`, '--skip-install'], tmpDir);

    expect(fs.existsSync(path.join(tmpDir, '.husky'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.husky', 'pre-commit'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Config files
// ---------------------------------------------------------------------------
describe('config files', () => {
  it('copies eslint-base.js as .eslintrc.js (rename)', () => {
    runScript([`--target=${tmpDir}`, '--skip-install'], tmpDir);

    expect(fs.existsSync(path.join(tmpDir, '.eslintrc.js'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'eslint-base.js'))).toBe(false);
  });

  it('copies .prettierrc to target root', () => {
    runScript([`--target=${tmpDir}`, '--skip-install'], tmpDir);

    expect(fs.existsSync(path.join(tmpDir, '.prettierrc'))).toBe(true);
  });

  it('copies lint-staged.config.js to target root', () => {
    runScript([`--target=${tmpDir}`, '--skip-install'], tmpDir);

    expect(fs.existsSync(path.join(tmpDir, 'lint-staged.config.js'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// .gitignore
// ---------------------------------------------------------------------------
describe('.gitignore handling', () => {
  it('creates .gitignore when none exists', () => {
    runScript([`--target=${tmpDir}`, '--skip-install'], tmpDir);

    expect(fs.existsSync(path.join(tmpDir, '.gitignore'))).toBe(true);
  });

  it('appends our patterns to existing .gitignore instead of replacing', () => {
    const gitignorePath = path.join(tmpDir, '.gitignore');
    fs.writeFileSync(gitignorePath, '# existing\nmy-file.txt\n');

    runScript([`--target=${tmpDir}`, '--skip-install'], tmpDir);

    const content = fs.readFileSync(gitignorePath, 'utf8');
    // Existing content preserved
    expect(content).toContain('my-file.txt');
    // Our patterns appended
    expect(content).toContain('node_modules/');
  });
});

// ---------------------------------------------------------------------------
// .env.example
// ---------------------------------------------------------------------------
describe('.env.example', () => {
  it('copies .env.example to target', () => {
    runScript([`--target=${tmpDir}`, '--skip-install'], tmpDir);

    expect(fs.existsSync(path.join(tmpDir, '.env.example'))).toBe(true);
  });

  it('does not overwrite existing .env.example', () => {
    const envExamplePath = path.join(tmpDir, '.env.example');
    fs.writeFileSync(envExamplePath, 'MY_CUSTOM_VAR=value\n');

    runScript([`--target=${tmpDir}`, '--skip-install'], tmpDir);

    const content = fs.readFileSync(envExamplePath, 'utf8');
    expect(content).toBe('MY_CUSTOM_VAR=value\n');
  });
});

// ---------------------------------------------------------------------------
// npm scripts
// ---------------------------------------------------------------------------
describe('npm scripts', () => {
  it('merges npm scripts into package.json without clobbering existing ones', () => {
    // Pre-set a test script with custom value
    const pkgPath = path.join(tmpDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.scripts = { test: 'my-custom-test', start: 'node index.js' };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

    runScript([`--target=${tmpDir}`, '--skip-install'], tmpDir);

    const updated = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    // Existing scripts not overwritten
    expect(updated.scripts.test).toBe('my-custom-test');
    expect(updated.scripts.start).toBe('node index.js');
    // New scripts added
    expect(updated.scripts['test:all']).toBeDefined();
    expect(updated.scripts['validate-docs']).toBeDefined();
    expect(updated.scripts['generate-docs']).toBeDefined();
    expect(updated.scripts['lint']).toBeDefined();
    expect(updated.scripts['posttest']).toBeDefined();
  });

  it('adds all required npm scripts when none exist', () => {
    runScript([`--target=${tmpDir}`, '--skip-install'], tmpDir);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
    expect(pkg.scripts.test).toBe('jest');
    expect(pkg.scripts['test:all']).toContain('jest');
    expect(pkg.scripts.posttest).toBe('git rev-parse HEAD > .test-passed');
    expect(pkg.scripts['validate-docs']).toBe('node scripts/validate-docs.js --full');
    expect(pkg.scripts['generate-docs']).toBe('node scripts/generate-docs.js');
    expect(pkg.scripts.lint).toBe('eslint src/');
  });
});

// ---------------------------------------------------------------------------
// lint-staged config
// ---------------------------------------------------------------------------
describe('lint-staged config', () => {
  it('adds lint-staged config to package.json if not present', () => {
    runScript([`--target=${tmpDir}`, '--skip-install'], tmpDir);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
    expect(pkg['lint-staged']).toBeDefined();
    expect(pkg['lint-staged']['src/**/*.js']).toContain('eslint --fix');
  });

  it('does not overwrite existing lint-staged config', () => {
    const pkgPath = path.join(tmpDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg['lint-staged'] = { '**/*.ts': ['prettier --write'] };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

    runScript([`--target=${tmpDir}`, '--skip-install'], tmpDir);

    const updated = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(updated['lint-staged']['**/*.ts']).toContain('prettier --write');
    expect(updated['lint-staged']['src/**/*.js']).toBeUndefined();
  });
});
