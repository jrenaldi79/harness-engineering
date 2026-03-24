/**
 * Tests for generate-docs-helpers.js: directory trees, module indexes,
 * JSDoc extraction, and export parsing.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  buildDirectoryTree,
  extractJSDocDescription,
  extractExports,
} = require('../../skills/setup/scripts/lib/generate-docs-helpers');

/** Create a temp directory for each test, cleaned up after. */
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-docs-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// extractJSDocDescription
// ---------------------------------------------------------------------------
describe('extractJSDocDescription', () => {
  it('extracts the first line of a JSDoc comment', () => {
    const filePath = path.join(tmpDir, 'mod.js');
    fs.writeFileSync(filePath, [
      '/**',
      ' * Context Drift Detection Module',
      ' *',
      ' * More details here.',
      ' */',
      'const x = 1;',
    ].join('\n'));
    expect(extractJSDocDescription(filePath)).toBe('Context Drift Detection Module');
  });

  it('returns empty string when no JSDoc exists', () => {
    const filePath = path.join(tmpDir, 'plain.js');
    fs.writeFileSync(filePath, 'const x = 1;\n');
    expect(extractJSDocDescription(filePath)).toBe('');
  });

  it('handles single-line JSDoc', () => {
    const filePath = path.join(tmpDir, 'one.js');
    fs.writeFileSync(filePath, '/** Short desc */\nmodule.exports = {};\n');
    expect(extractJSDocDescription(filePath)).toBe('Short desc');
  });

  it('ignores non-JSDoc block comments', () => {
    const filePath = path.join(tmpDir, 'block.js');
    fs.writeFileSync(filePath, '/* not jsdoc */\nconst x = 1;\n');
    expect(extractJSDocDescription(filePath)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// extractExports
// ---------------------------------------------------------------------------
describe('extractExports', () => {
  it('extracts named exports from module.exports object', () => {
    const filePath = path.join(tmpDir, 'exp.js');
    fs.writeFileSync(filePath, [
      'function foo() {}',
      'function bar() {}',
      'module.exports = {',
      '  foo,',
      '  bar,',
      '};',
    ].join('\n'));
    const exports = extractExports(filePath);
    expect(exports).toContain('foo');
    expect(exports).toContain('bar');
  });

  it('extracts exports.name = assignments', () => {
    const filePath = path.join(tmpDir, 'named.js');
    fs.writeFileSync(filePath, [
      'exports.alpha = function() {};',
      'exports.beta = 42;',
    ].join('\n'));
    const exports = extractExports(filePath);
    expect(exports).toContain('alpha');
    expect(exports).toContain('beta');
  });

  it('caps at 5 exports', () => {
    const filePath = path.join(tmpDir, 'many.js');
    fs.writeFileSync(filePath, [
      'module.exports = {',
      '  a, b, c, d, e, f, g,',
      '};',
    ].join('\n'));
    const exports = extractExports(filePath);
    expect(exports.length).toBeLessThanOrEqual(5);
  });

  it('returns empty array for files with no exports', () => {
    const filePath = path.join(tmpDir, 'none.js');
    fs.writeFileSync(filePath, 'const x = 1;\n');
    expect(extractExports(filePath)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildDirectoryTree
// ---------------------------------------------------------------------------
describe('buildDirectoryTree', () => {
  it('builds a tree with files and directories', () => {
    // Create structure: root/src/foo.js, root/src/utils/bar.js
    const srcDir = path.join(tmpDir, 'src');
    const utilsDir = path.join(srcDir, 'utils');
    fs.mkdirSync(utilsDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'foo.js'), '/** Foo module */\nmodule.exports = {};\n');
    fs.writeFileSync(path.join(utilsDir, 'bar.js'), '/** Bar util */\nmodule.exports = {};\n');

    const tree = buildDirectoryTree(tmpDir, ['src/']);
    expect(tree).toContain('src/');
    expect(tree).toContain('foo.js');
    expect(tree).toContain('utils/');
    expect(tree).toContain('bar.js');
  });

  it('sorts directories before files', () => {
    const srcDir = path.join(tmpDir, 'src');
    const subDir = path.join(srcDir, 'aaa');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'zzz.js'), '');
    fs.writeFileSync(path.join(subDir, 'inner.js'), '');

    const tree = buildDirectoryTree(tmpDir, ['src/']);
    const lines = tree.split('\n');
    // The subdirectory 'aaa/' should appear before file 'zzz.js'
    const aaaIdx = lines.findIndex(l => l.includes('aaa/'));
    const zzzIdx = lines.findIndex(l => l.includes('zzz.js'));
    expect(aaaIdx).toBeLessThan(zzzIdx);
  });

  it('uses tree connectors', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'a.js'), '');
    fs.writeFileSync(path.join(srcDir, 'b.js'), '');

    const tree = buildDirectoryTree(tmpDir, ['src/']);
    // Should have either ├── or └── connectors
    expect(tree).toMatch(/[├└]──/);
  });

  it('skips directories in SKIP_DIRS', () => {
    const srcDir = path.join(tmpDir, 'src');
    const nodeModules = path.join(srcDir, 'node_modules');
    fs.mkdirSync(nodeModules, { recursive: true });
    fs.writeFileSync(path.join(nodeModules, 'pkg.js'), '');
    fs.writeFileSync(path.join(srcDir, 'real.js'), '');

    const tree = buildDirectoryTree(tmpDir, ['src/']);
    expect(tree).not.toContain('node_modules');
    expect(tree).toContain('real.js');
  });

  it('skips dotfiles', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, '.hidden'), '');
    fs.writeFileSync(path.join(srcDir, 'visible.js'), '');

    const tree = buildDirectoryTree(tmpDir, ['src/']);
    expect(tree).not.toContain('.hidden');
    expect(tree).toContain('visible.js');
  });

  it('includes JSDoc annotations for .js files', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'mod.js'), '/** My Module */\nmodule.exports = {};\n');

    const tree = buildDirectoryTree(tmpDir, ['src/']);
    expect(tree).toContain('mod.js');
    // The annotation should appear on the same line
    const modLine = tree.split('\n').find(l => l.includes('mod.js'));
    expect(modLine).toContain('My Module');
  });

  it('handles multiple top-level dirs', () => {
    fs.mkdirSync(path.join(tmpDir, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'scripts', 'cli.js'), '');
    fs.writeFileSync(path.join(tmpDir, 'src', 'main.js'), '');

    const tree = buildDirectoryTree(tmpDir, ['scripts/', 'src/']);
    expect(tree).toContain('scripts/');
    expect(tree).toContain('src/');
    expect(tree).toContain('cli.js');
    expect(tree).toContain('main.js');
  });
});

// detectSourceDirs and buildModuleIndex tests are in detect-source-dirs.test.js
