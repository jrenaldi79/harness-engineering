/**
 * Tests for incremental doc indexing — verifies that adding a new source file
 * and re-running the generate-docs pipeline causes the file to appear in
 * AUTO:tree and AUTO:modules markers.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  replaceMarkers,
  checkMarkersAreCurrent,
} = require('../../skills/setup/scripts/lib/generate-docs');

const {
  buildDirectoryTree,
  buildModuleIndex,
} = require('../../skills/setup/scripts/lib/generate-docs-helpers');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'incr-docs-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Create a CLAUDE.md with empty AUTO markers.
 */
function createClaudeMd() {
  const content = [
    '# Project',
    '',
    '## Architecture',
    '',
    '<!-- AUTO:tree -->',
    '<!-- /AUTO:tree -->',
    '',
    '## Key Modules',
    '',
    '<!-- AUTO:modules -->',
    '<!-- /AUTO:modules -->',
  ].join('\n');
  fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), content);
  return content;
}

/**
 * Create a JS source file with JSDoc.
 */
function createSourceFile(relPath, jsdoc, exports) {
  const fullPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const lines = [];
  if (jsdoc) lines.push(`/**\n * ${jsdoc}\n */`);
  if (exports) lines.push(`module.exports = { ${exports.join(', ')} };`);
  if (!jsdoc && !exports) lines.push('// empty file');
  fs.writeFileSync(fullPath, lines.join('\n') + '\n');
}

// ---------------------------------------------------------------------------
// Incremental tree indexing
// ---------------------------------------------------------------------------
describe('incremental tree indexing', () => {
  it('includes initial files in tree', () => {
    createSourceFile('src/alpha.js', 'Alpha module', ['alpha']);

    const tree = buildDirectoryTree(tmpDir, ['src/']);
    expect(tree).toContain('alpha.js');
  });

  it('picks up newly added files on re-scan', () => {
    createSourceFile('src/alpha.js', 'Alpha module', ['alpha']);

    // First scan
    let tree = buildDirectoryTree(tmpDir, ['src/']);
    expect(tree).toContain('alpha.js');
    expect(tree).not.toContain('beta.js');

    // Add new file
    createSourceFile('src/beta.js', 'Beta module', ['beta']);

    // Second scan
    tree = buildDirectoryTree(tmpDir, ['src/']);
    expect(tree).toContain('alpha.js');
    expect(tree).toContain('beta.js');
  });

  it('picks up files in new subdirectories', () => {
    createSourceFile('src/core/main.js', 'Main entry', ['main']);

    let tree = buildDirectoryTree(tmpDir, ['src/']);
    expect(tree).toContain('main.js');

    // Add new subdirectory with file
    createSourceFile('src/utils/helpers.js', 'Helper functions', ['help']);

    tree = buildDirectoryTree(tmpDir, ['src/']);
    expect(tree).toContain('helpers.js');
    expect(tree).toContain('utils/');
  });

  it('includes JSDoc annotations in tree', () => {
    createSourceFile('src/worker.js', 'Background job processor', ['run']);

    const tree = buildDirectoryTree(tmpDir, ['src/']);
    expect(tree).toContain('Background job processor');
  });
});

// ---------------------------------------------------------------------------
// Incremental module indexing
// ---------------------------------------------------------------------------
describe('incremental module indexing', () => {
  it('includes initial modules in index', () => {
    createSourceFile('src/alpha.js', 'Alpha module', ['alpha']);

    const modules = buildModuleIndex(tmpDir);
    expect(modules).toContain('alpha.js');
    expect(modules).toContain('Alpha module');
  });

  it('picks up newly added modules on re-scan', () => {
    createSourceFile('src/alpha.js', 'Alpha module', ['alpha']);

    // First scan
    let modules = buildModuleIndex(tmpDir);
    expect(modules).toContain('alpha.js');

    // Add new module
    createSourceFile('src/gamma.js', 'Gamma processor', ['process']);

    // Second scan
    modules = buildModuleIndex(tmpDir);
    expect(modules).toContain('alpha.js');
    expect(modules).toContain('gamma.js');
    expect(modules).toContain('Gamma processor');
  });

  it('includes JSDoc descriptions and exports', () => {
    createSourceFile('src/service.js', 'User service layer', ['getUser', 'createUser']);

    const modules = buildModuleIndex(tmpDir);
    expect(modules).toContain('User service layer');
    expect(modules).toContain('`getUser()`');
    expect(modules).toContain('`createUser()`');
  });
});

// ---------------------------------------------------------------------------
// Full round-trip: markers + staleness detection
// ---------------------------------------------------------------------------
describe('full round-trip with markers', () => {
  it('regenerated markers pass staleness check', () => {
    createSourceFile('src/one.js', 'Module one', ['one']);
    let doc = createClaudeMd();

    // Generate and replace markers
    const tree = buildDirectoryTree(tmpDir, ['src/']);
    const modules = buildModuleIndex(tmpDir);

    doc = replaceMarkers(doc, 'tree', tree);
    doc = replaceMarkers(doc, 'modules', modules);
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), doc);

    // Staleness check should pass
    const stale = checkMarkersAreCurrent(doc, { tree, modules });
    expect(stale).toHaveLength(0);
  });

  it('detects staleness after new file added without regeneration', () => {
    createSourceFile('src/one.js', 'Module one', ['one']);
    let doc = createClaudeMd();

    // Initial generation
    let tree = buildDirectoryTree(tmpDir, ['src/']);
    let modules = buildModuleIndex(tmpDir);
    doc = replaceMarkers(doc, 'tree', tree);
    doc = replaceMarkers(doc, 'modules', modules);
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), doc);

    // Add new file without regenerating markers
    createSourceFile('src/two.js', 'Module two', ['two']);

    // Regenerate expected content (but don't write to CLAUDE.md)
    tree = buildDirectoryTree(tmpDir, ['src/']);
    modules = buildModuleIndex(tmpDir);

    // Staleness check should detect the drift
    const stale = checkMarkersAreCurrent(doc, { tree, modules });
    expect(stale.length).toBeGreaterThan(0);
  });

  it('staleness resolves after regeneration', () => {
    createSourceFile('src/one.js', 'Module one', ['one']);
    let doc = createClaudeMd();

    // Initial generation
    let tree = buildDirectoryTree(tmpDir, ['src/']);
    let modules = buildModuleIndex(tmpDir);
    doc = replaceMarkers(doc, 'tree', tree);
    doc = replaceMarkers(doc, 'modules', modules);

    // Add new file
    createSourceFile('src/two.js', 'Module two', ['two']);

    // Regenerate markers
    tree = buildDirectoryTree(tmpDir, ['src/']);
    modules = buildModuleIndex(tmpDir);
    doc = replaceMarkers(doc, 'tree', tree);
    doc = replaceMarkers(doc, 'modules', modules);
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), doc);

    // Now it should pass
    const stale = checkMarkersAreCurrent(doc, { tree, modules });
    expect(stale).toHaveLength(0);

    // And the new file should be in the doc
    expect(doc).toContain('two.js');
    expect(doc).toContain('Module two');
  });

  it('handles file removal from markers', () => {
    createSourceFile('src/keep.js', 'Keeper', ['keep']);
    createSourceFile('src/remove.js', 'To remove', ['remove']);
    let doc = createClaudeMd();

    // Initial generation with both files
    let tree = buildDirectoryTree(tmpDir, ['src/']);
    let modules = buildModuleIndex(tmpDir);
    doc = replaceMarkers(doc, 'tree', tree);
    doc = replaceMarkers(doc, 'modules', modules);
    expect(doc).toContain('remove.js');

    // Delete file
    fs.unlinkSync(path.join(tmpDir, 'src/remove.js'));

    // Regenerate
    tree = buildDirectoryTree(tmpDir, ['src/']);
    modules = buildModuleIndex(tmpDir);
    doc = replaceMarkers(doc, 'tree', tree);
    doc = replaceMarkers(doc, 'modules', modules);

    expect(doc).toContain('keep.js');
    expect(doc).not.toContain('remove.js');
  });
});
