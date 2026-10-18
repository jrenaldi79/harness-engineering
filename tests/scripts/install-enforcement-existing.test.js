/**
 * install-enforcement.js against existing projects that already chose their tools:
 * an ESLint flat config must not gain a legacy .eslintrc.js, an existing .eslintrc.js
 * must not be overwritten, and a Vitest project must not gain Jest scripts.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../../skills/setup/scripts/install-enforcement.js');

let tmpDir;

function writePkg(pkg) {
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
}

function install() {
  execFileSync(process.execPath, [SCRIPT, `--target=${tmpDir}`, '--skip-install'], {
    cwd: tmpDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-existing-'));
  fs.mkdirSync(path.join(tmpDir, '.husky'), { recursive: true });
  writePkg({ name: 'existing', version: '1.0.0', scripts: {}, devDependencies: {} });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('ESLint config detection', () => {
  it.each(['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts'])(
    'does not add .eslintrc.js next to %s',
    flat => {
      fs.writeFileSync(path.join(tmpDir, flat), 'export default [];\n');
      install();
      expect(fs.existsSync(path.join(tmpDir, '.eslintrc.js'))).toBe(false);
    }
  );

  it('does not overwrite an existing .eslintrc.js', () => {
    fs.writeFileSync(path.join(tmpDir, '.eslintrc.js'), 'module.exports = { custom: true };\n');
    install();
    expect(fs.readFileSync(path.join(tmpDir, '.eslintrc.js'), 'utf8')).toContain('custom: true');
  });
});

describe('test runner detection', () => {
  it.each(['devDependencies', 'dependencies'])('adds no Jest scripts when vitest is in %s', field => {
    writePkg({ name: 'existing', version: '1.0.0', scripts: {}, [field]: { vitest: '5.0.5' } });
    const pkg = install();
    expect(pkg.scripts.test).toBe('vitest run');
    expect(JSON.stringify(pkg.scripts)).not.toContain('jest');
  });

  it('keeps an existing test script untouched', () => {
    writePkg({ name: 'existing', version: '1.0.0', scripts: { test: 'vitest run --project unit' }, devDependencies: { vitest: '5.0.5' } });
    expect(install().scripts.test).toBe('vitest run --project unit');
  });
});

describe('folder notes', () => {
  const config = () => JSON.parse(fs.readFileSync(path.join(tmpDir, 'documentation.config.json'), 'utf8'));
  const run = args =>
    execFileSync(process.execPath, [SCRIPT, `--target=${tmpDir}`, '--skip-install', ...args], { cwd: tmpDir, stdio: 'pipe' });

  it('enables folder notes in the documentation config with --folder-notes', () => {
    run(['--folder-notes']);
    expect(config().folderNotes).toBe(true);
  });

  it('leaves folder notes off by default', () => {
    run([]);
    expect(config().folderNotes).toBeUndefined();
  });
});
