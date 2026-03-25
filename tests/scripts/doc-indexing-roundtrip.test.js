/**
 * Tests for post-install doc indexing round-trip — verifies that
 * generate-docs.js correctly indexes source and doc files when run as a
 * subprocess in a scaffolded project.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const INSTALL_SCRIPT = path.resolve(
  __dirname,
  '../../skills/setup/scripts/install-enforcement.js'
);

const CLAUDE_MD_CONTENT = [
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

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-roundtrip-'));

  // 1. Minimal package.json + .husky dir
  fs.writeFileSync(
    path.join(tmpDir, 'package.json'),
    JSON.stringify(
      { name: 'test-proj', version: '1.0.0', scripts: {}, devDependencies: {} },
      null,
      2
    ) + '\n'
  );
  fs.mkdirSync(path.join(tmpDir, '.husky'), { recursive: true });

  // 2. Run install-enforcement to scaffold scripts/
  execFileSync(
    process.execPath,
    [INSTALL_SCRIPT, `--target=${tmpDir}`, '--skip-install'],
    { cwd: tmpDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );

  // 3. Create CLAUDE.md with AUTO markers
  fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), CLAUDE_MD_CONTENT);

  // 4. git init (generate-docs.js auto-stages files)
  execFileSync('git', ['init'], {
    cwd: tmpDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Run generate-docs.js in tmpDir with optional extra args. */
function runGenerateDocs(extraArgs = []) {
  const script = path.join(tmpDir, 'scripts', 'generate-docs.js');
  return execFileSync(process.execPath, [script, ...extraArgs], {
    cwd: tmpDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Create a source file with optional JSDoc + module.exports. */
function createFile(relPath, content) {
  const fullPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function readClaudeMd() {
  return fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf8');
}

// ---------------------------------------------------------------------------
// Tree indexing
// ---------------------------------------------------------------------------
describe('tree indexing', () => {
  it('indexes new source file', () => {
    createFile('src/foo.js', '/** Foo handler */\nmodule.exports = {};\n');
    runGenerateDocs();

    const doc = readClaudeMd();
    expect(doc).toContain('foo.js');
  });

  it('indexes files in subdirectories', () => {
    createFile(
      'src/utils/helpers.js',
      '/** Helper utilities */\nmodule.exports = {};\n'
    );
    runGenerateDocs();

    const doc = readClaudeMd();
    expect(doc).toContain('helpers.js');
    expect(doc).toContain('utils/');
  });
});

// ---------------------------------------------------------------------------
// Module indexing
// ---------------------------------------------------------------------------
describe('module indexing', () => {
  it('indexes exports and JSDoc', () => {
    createFile(
      'src/service.js',
      '/** User service layer */\nmodule.exports = { getUser, createUser };\n'
    );
    runGenerateDocs();

    const doc = readClaudeMd();
    expect(doc).toContain('User service layer');
    expect(doc).toContain('service.js');
  });
});

// ---------------------------------------------------------------------------
// Incremental
// ---------------------------------------------------------------------------
describe('incremental', () => {
  it('picks up newly added file', () => {
    createFile('src/a.js', '/** A module */\nmodule.exports = {};\n');
    runGenerateDocs();

    let doc = readClaudeMd();
    expect(doc).toContain('a.js');

    createFile('src/b.js', '/** B module */\nmodule.exports = {};\n');
    runGenerateDocs();

    doc = readClaudeMd();
    expect(doc).toContain('a.js');
    expect(doc).toContain('b.js');
  });

  it('removes deleted file', () => {
    createFile('src/a.js', '/** A module */\nmodule.exports = {};\n');
    createFile('src/b.js', '/** B module */\nmodule.exports = {};\n');
    runGenerateDocs();

    let doc = readClaudeMd();
    expect(doc).toContain('a.js');
    expect(doc).toContain('b.js');

    fs.unlinkSync(path.join(tmpDir, 'src', 'b.js'));
    runGenerateDocs();

    doc = readClaudeMd();
    expect(doc).toContain('a.js');
    expect(doc).not.toContain('b.js');
  });
});

// ---------------------------------------------------------------------------
// Check mode
// ---------------------------------------------------------------------------
describe('check mode', () => {
  it('--check passes after generation', () => {
    createFile('src/a.js', '/** A module */\nmodule.exports = {};\n');
    runGenerateDocs();

    // Should not throw
    expect(() => runGenerateDocs(['--check'])).not.toThrow();
  });

  it('--check fails when stale', () => {
    createFile('src/a.js', '/** A module */\nmodule.exports = {};\n');
    runGenerateDocs();

    // Add file without regenerating
    createFile('src/new.js', '/** New module */\nmodule.exports = {};\n');

    expect(() => runGenerateDocs(['--check'])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Docs indexing
// ---------------------------------------------------------------------------
describe('docs indexing', () => {
  it('creates docs/plans/index.md', () => {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'plans'), { recursive: true });
    createFile('docs/plans/design.md', '# Design Doc\n');

    runGenerateDocs();

    const indexPath = path.join(tmpDir, 'docs', 'plans', 'index.md');
    expect(fs.existsSync(indexPath)).toBe(true);
    const content = fs.readFileSync(indexPath, 'utf8');
    expect(content).toContain('design.md');
  });
});
