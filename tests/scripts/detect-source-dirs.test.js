/**
 * Tests for detectSourceDirs and buildModuleIndex adaptive scanning.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  buildModuleIndex,
  detectSourceDirs,
} = require('../../skills/setup/scripts/lib/generate-docs-helpers');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-src-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// detectSourceDirs
// ---------------------------------------------------------------------------
describe('detectSourceDirs', () => {
  it('detects src/ as a source directory', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), '');
    const dirs = detectSourceDirs(tmpDir);
    expect(dirs).toContain('src/');
  });

  it('detects lib/ as a source directory', () => {
    fs.mkdirSync(path.join(tmpDir, 'lib'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'lib', 'utils.js'), '');
    const dirs = detectSourceDirs(tmpDir);
    expect(dirs).toContain('lib/');
  });

  it('detects packages/ in a monorepo', () => {
    fs.mkdirSync(path.join(tmpDir, 'packages', 'api'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'packages', 'api', 'index.js'), '');
    const dirs = detectSourceDirs(tmpDir);
    expect(dirs).toContain('packages/');
  });

  it('detects apps/ in a monorepo', () => {
    fs.mkdirSync(path.join(tmpDir, 'apps', 'web'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'apps', 'web', 'page.tsx'), '');
    const dirs = detectSourceDirs(tmpDir);
    expect(dirs).toContain('apps/');
  });

  it('detects services/ directory', () => {
    fs.mkdirSync(path.join(tmpDir, 'services', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'services', 'auth', 'handler.ts'), '');
    const dirs = detectSourceDirs(tmpDir);
    expect(dirs).toContain('services/');
  });

  it('detects cmd/ for Go projects', () => {
    fs.mkdirSync(path.join(tmpDir, 'cmd', 'server'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'cmd', 'server', 'main.go'), '');
    const dirs = detectSourceDirs(tmpDir);
    expect(dirs).toContain('cmd/');
  });

  it('detects Python package directories', () => {
    fs.mkdirSync(path.join(tmpDir, 'mypackage'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'mypackage', '__init__.py'), '');
    fs.writeFileSync(path.join(tmpDir, 'mypackage', 'core.py'), '');
    const dirs = detectSourceDirs(tmpDir);
    expect(dirs).toContain('mypackage/');
  });

  it('always includes scripts/ and tests/ if they exist', () => {
    fs.mkdirSync(path.join(tmpDir, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'scripts', 'build.sh'), '');
    fs.writeFileSync(path.join(tmpDir, 'tests', 'test_app.py'), '');
    const dirs = detectSourceDirs(tmpDir);
    expect(dirs).toContain('scripts/');
    expect(dirs).toContain('tests/');
  });

  it('excludes node_modules and other skip dirs', () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'coverage'), { recursive: true });
    const dirs = detectSourceDirs(tmpDir);
    expect(dirs).not.toContain('node_modules/');
    expect(dirs).not.toContain('dist/');
    expect(dirs).not.toContain('coverage/');
  });

  it('excludes empty directories', () => {
    fs.mkdirSync(path.join(tmpDir, 'empty_dir'), { recursive: true });
    const dirs = detectSourceDirs(tmpDir);
    expect(dirs).not.toContain('empty_dir/');
  });
});

// ---------------------------------------------------------------------------
// buildModuleIndex (adaptive)
// ---------------------------------------------------------------------------
describe('buildModuleIndex', () => {
  it('builds a table from src/', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'cli.js'), [
      '/** CLI Argument Parser */',
      'function parseArgs() {}',
      'module.exports = { parseArgs };',
    ].join('\n'));

    const table = buildModuleIndex(tmpDir);
    expect(table).toContain('cli.js');
    expect(table).toContain('CLI Argument Parser');
    expect(table).toContain('parseArgs');
  });

  it('indexes modules from lib/ alongside src/', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'lib'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), '/** Main app */\nmodule.exports = {};');
    fs.writeFileSync(path.join(tmpDir, 'lib', 'helper.js'), '/** Helper utils */\nmodule.exports = {};');

    const table = buildModuleIndex(tmpDir);
    expect(table).toContain('src/app.js');
    expect(table).toContain('lib/helper.js');
  });

  it('indexes modules from packages/ in monorepos', () => {
    const pkgDir = path.join(tmpDir, 'packages', 'api', 'src');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'routes.js'), '/** API routes */\nmodule.exports = {};');

    const table = buildModuleIndex(tmpDir);
    expect(table).toContain('routes.js');
    expect(table).toContain('API routes');
  });

  it('includes files in subdirectories', () => {
    const utilsDir = path.join(tmpDir, 'src', 'utils');
    fs.mkdirSync(utilsDir, { recursive: true });
    fs.writeFileSync(path.join(utilsDir, 'logger.js'), [
      '/** Structured logging */',
      'exports.logger = {};',
    ].join('\n'));

    const table = buildModuleIndex(tmpDir);
    expect(table).toContain('logger.js');
    expect(table).toContain('Structured logging');
  });

  it('returns header-only table when no source dirs exist', () => {
    const table = buildModuleIndex(tmpDir);
    const lines = table.trim().split('\n');
    expect(lines.length).toBe(2);
  });

  it('handles files with no JSDoc gracefully', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'bare.js'), 'const x = 1;\n');

    const table = buildModuleIndex(tmpDir);
    expect(table).toContain('bare.js');
    expect(table).toContain('|');
  });
});
