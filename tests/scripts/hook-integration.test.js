/**
 * Tests for git commit hook integration — verifies that git commit triggers
 * the pre-commit hook, blocks bad code, and auto-updates CLAUDE.md.
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

const HOOK_BODY = `#!/usr/bin/env bash
set -e
node scripts/check-secrets.js
node scripts/check-file-sizes.js
node scripts/check-test-colocation.js
node scripts/generate-docs.js
node scripts/validate-docs.js
`;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-integ-'));

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

  // 4. Write custom pre-commit hook to .git/hooks/
  const hookPath = path.join(tmpDir, '.git', 'hooks', 'pre-commit');
  fs.mkdirSync(path.dirname(hookPath), { recursive: true });
  fs.writeFileSync(hookPath, HOOK_BODY);
  fs.chmodSync(hookPath, 0o755);

  // 5. Create CLAUDE.md with AUTO markers
  const claudeMd = [
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
  fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), claudeMd);

  // 6. Create src/sub/ directory
  fs.mkdirSync(path.join(tmpDir, 'src', 'sub'), { recursive: true });

  // 7. Initial commit
  execFileSync('git', ['add', '-A'], { cwd: tmpDir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'init', '--no-verify'], {
    cwd: tmpDir,
    stdio: 'ignore',
  });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Hook integration tests
// ---------------------------------------------------------------------------
describe('git pre-commit hook integration', () => {
  it('blocks secrets via hook', () => {
    // Create a source file with a secret
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'sub', 'config.js'),
      'const key = "sk-ant-test123abc456";\nmodule.exports = { key };\n'
    );
    // Colocation test file so that check passes
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'sub', 'config.test.js'),
      'test("placeholder", () => {});\n'
    );

    execFileSync('git', ['add', '-A'], { cwd: tmpDir, stdio: 'ignore' });

    expect(() => {
      execFileSync('git', ['commit', '-m', 'bad'], {
        cwd: tmpDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }).toThrow();
  });

  it('allows clean commit', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'sub', 'app.js'),
      '/** App module */\nfunction run() { return true; }\nmodule.exports = { run };\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'sub', 'app.test.js'),
      'test("placeholder", () => {});\n'
    );

    execFileSync('git', ['add', '-A'], { cwd: tmpDir, stdio: 'ignore' });

    expect(() => {
      execFileSync('git', ['commit', '-m', 'clean'], {
        cwd: tmpDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }).not.toThrow();
  });

  it('auto-updates CLAUDE.md on commit', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'sub', 'app.js'),
      '/** App module */\nfunction run() { return true; }\nmodule.exports = { run };\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'sub', 'app.test.js'),
      'test("placeholder", () => {});\n'
    );

    execFileSync('git', ['add', '-A'], { cwd: tmpDir, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'with-docs'], {
      cwd: tmpDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const claudeMd = fs.readFileSync(
      path.join(tmpDir, 'CLAUDE.md'),
      'utf8'
    );
    expect(claudeMd).toContain('app.js');
  });
});
