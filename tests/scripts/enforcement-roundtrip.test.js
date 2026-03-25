/**
 * Tests for post-install enforcement script round-trip — verifies that scripts
 * installed by install-enforcement.js actually block bad code when run against
 * a real git staging area.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const installScript = path.resolve(
  __dirname,
  '../../skills/setup/scripts/install-enforcement.js'
);

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enforcement-rt-'));

  // Scaffold target project with package.json and .husky/
  fs.writeFileSync(
    path.join(tmpDir, 'package.json'),
    JSON.stringify({ name: 'test-project', version: '1.0.0' })
  );
  fs.mkdirSync(path.join(tmpDir, '.husky'), { recursive: true });

  // Run install-enforcement.js to copy scripts into tmpDir
  execFileSync(
    process.execPath,
    [installScript, `--target=${tmpDir}`, '--skip-install'],
    { cwd: tmpDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );

  // Initialize a real git repo so git diff --cached works
  execFileSync('git', ['init'], { cwd: tmpDir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test'], {
    cwd: tmpDir,
    stdio: 'ignore',
  });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], {
    cwd: tmpDir,
    stdio: 'ignore',
  });
  execFileSync('git', ['config', 'commit.gpgSign', 'false'], {
    cwd: tmpDir,
    stdio: 'ignore',
  });

  // Create an initial commit so HEAD exists for git diff --cached
  fs.writeFileSync(path.join(tmpDir, '.gitkeep'), '');
  execFileSync('git', ['add', '.gitkeep'], { cwd: tmpDir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'init'], {
    cwd: tmpDir,
    stdio: 'ignore',
  });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function runScript(scriptName) {
  return execFileSync(
    process.execPath,
    [path.join('scripts', scriptName)],
    { cwd: tmpDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
}

function stageFile(relativePath, content) {
  const fullPath = path.join(tmpDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  execFileSync('git', ['add', relativePath], {
    cwd: tmpDir,
    stdio: 'ignore',
  });
}

// ---------------------------------------------------------------------------
// check-secrets.js
// ---------------------------------------------------------------------------
describe('check-secrets.js (post-install)', () => {
  const script = 'check-secrets.js';

  test('blocks staged file containing a secret', () => {
    stageFile(
      'src/sub/config.js',
      'const key = "sk-ant-test123abc456";\n'
    );
    expect(() => runScript(script)).toThrow();
  });

  test('passes clean staged files', () => {
    stageFile(
      'src/sub/app.js',
      'const greeting = "hello world";\n'
    );
    expect(() => runScript(script)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// check-file-sizes.js
// ---------------------------------------------------------------------------
describe('check-file-sizes.js (post-install)', () => {
  const script = 'check-file-sizes.js';

  test('blocks staged file over 300 lines', () => {
    const lines = Array.from({ length: 301 }, (_, i) => `// line ${i + 1}`)
      .join('\n') + '\n';
    stageFile('src/sub/big.js', lines);
    expect(() => runScript(script)).toThrow();
  });

  test('passes files under limit', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `// line ${i + 1}`)
      .join('\n') + '\n';
    stageFile('src/sub/small.js', lines);
    expect(() => runScript(script)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// check-test-colocation.js
// ---------------------------------------------------------------------------
describe('check-test-colocation.js (post-install)', () => {
  const script = 'check-test-colocation.js';

  test('blocks src file without colocated test', () => {
    stageFile('src/sub/service.ts', 'export class Service {}\n');
    expect(() => runScript(script)).toThrow();
  });

  test('passes src file with colocated test', () => {
    stageFile('src/sub/service.ts', 'export class Service {}\n');
    stageFile(
      'src/sub/service.test.ts',
      'import { Service } from "./service";\n'
    );
    expect(() => runScript(script)).not.toThrow();
  });
});
