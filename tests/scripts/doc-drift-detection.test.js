/**
 * Tests for doc drift detection — verifies validate-docs.js catches
 * documentation drift in both pre-commit and full analysis modes.
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

let tmpDir;
let validateScript;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-drift-'));

  // 1. Minimal package.json + .husky dir
  fs.writeFileSync(
    path.join(tmpDir, 'package.json'),
    JSON.stringify(
      { name: 'test', version: '1.0.0', scripts: {}, devDependencies: {} },
      null,
      2
    ) + '\n'
  );
  fs.mkdirSync(path.join(tmpDir, '.husky'), { recursive: true });

  // 2. Run install-enforcement.js
  execFileSync(
    process.execPath,
    [INSTALL_SCRIPT, `--target=${tmpDir}`, '--skip-install'],
    { cwd: tmpDir, stdio: 'ignore' }
  );

  validateScript = path.join(tmpDir, 'scripts', 'validate-docs.js');

  // 3. git init + config
  execFileSync('git', ['init'], { cwd: tmpDir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test'], {
    cwd: tmpDir,
    stdio: 'ignore',
  });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], {
    cwd: tmpDir,
    stdio: 'ignore',
  });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], {
    cwd: tmpDir,
    stdio: 'ignore',
  });

  // 4. Create CLAUDE.md with Key Modules referencing src/existing.js
  const claudeMd = [
    '# Project',
    '',
    '## Key Modules',
    '',
    '| Module | Purpose |',
    '|--------|---------|',
    '| `src/existing.js` | Existing module |',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), claudeMd);

  // 5. Create src/existing.js on disk
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'src', 'existing.js'),
    '/** Existing module */\nmodule.exports = {};\n'
  );

  // 6. Initial commit
  execFileSync('git', ['add', '-A'], { cwd: tmpDir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'init', '--no-verify'], {
    cwd: tmpDir,
    stdio: 'ignore',
  });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const { spawnSync } = require('node:child_process');

/** Run validate-docs.js and return { stdout, stderr, status }. */
function runValidate(args = []) {
  const result = spawnSync(process.execPath, [validateScript, ...args], {
    cwd: tmpDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
  };
}

// ---------------------------------------------------------------------------
// Pre-commit mode (default, no --full flag)
// ---------------------------------------------------------------------------
describe('pre-commit mode', () => {
  it('warns when src/ changed but CLAUDE.md not staged', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'new.js'),
      '// new file\n'
    );
    execFileSync('git', ['add', 'src/new.js'], {
      cwd: tmpDir,
      stdio: 'ignore',
    });

    const result = runValidate();
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('Warning');
  });

  it('no warning when CLAUDE.md also staged', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'new.js'),
      '// new file\n'
    );
    // Touch CLAUDE.md so it has a change to stage
    const claudePath = path.join(tmpDir, 'CLAUDE.md');
    const current = fs.readFileSync(claudePath, 'utf8');
    fs.writeFileSync(claudePath, current + '\n<!-- updated -->\n');

    execFileSync('git', ['add', 'src/new.js', 'CLAUDE.md'], {
      cwd: tmpDir,
      stdio: 'ignore',
    });

    const result = runValidate();
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('Warning');
    expect(result.stderr).not.toContain('Warning');
  });

  it('no warning for non-tracked dirs', () => {
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'readme.md'),
      '# Docs\n'
    );
    execFileSync('git', ['add', 'docs/readme.md'], {
      cwd: tmpDir,
      stdio: 'ignore',
    });

    const result = runValidate();
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('Warning');
    expect(result.stderr).not.toContain('Warning');
  });
});

// ---------------------------------------------------------------------------
// Full mode (--full flag)
// ---------------------------------------------------------------------------
describe('full mode', () => {
  it('catches file missing from docs', () => {
    // Create an undocumented file in src/
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'undocumented.js'),
      '// not in CLAUDE.md\n'
    );

    const result = runValidate(['--full']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('undocumented.js');
  });

  it('catches documented file deleted from disk', () => {
    // CLAUDE.md references src/existing.js — delete it
    fs.unlinkSync(path.join(tmpDir, 'src', 'existing.js'));

    const result = runValidate(['--full']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('existing.js');
  });

  it('passes when in sync', () => {
    // src/existing.js exists and is documented — should be fine
    const result = runValidate(['--full']);
    expect(result.status).toBe(0);
  });
});
