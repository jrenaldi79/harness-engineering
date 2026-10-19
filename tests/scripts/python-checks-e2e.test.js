/**
 * End to end: the Python checks installed by install-python.js block bad staged
 * changes in a real git repository, and their shipped pytest suite passes there.
 * Needs python3 (3.9+); the pytest suite is skipped when pytest is not installed.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../../skills/setup/scripts/install-python.js');
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';
const hasPytest = spawnSync(PYTHON, ['-m', 'pytest', '--version']).status === 0;

let tmpDir;

function put(rel, content) {
  const file = path.join(tmpDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const git = (...args) => execFileSync('git', args, { cwd: tmpDir, encoding: 'utf8' });
const check = name => spawnSync(PYTHON, ['-m', `scripts.checks.${name}`], { cwd: tmpDir, encoding: 'utf8' });
const lines = n => 'x = 1\n'.repeat(n);

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'py-checks-e2e-'));
  put('pyproject.toml', '[project]\nname = "demo"\n');
  put('src/demo/__init__.py', '');
  put('src/demo/big.py', lines(400));
  put('tests/test_big.py', 'def test_ok():\n    assert True\n');
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  execFileSync(process.execPath, [SCRIPT, `--target=${tmpDir}`, '--skip-install'], { stdio: 'ignore' });
  git('add', '-A');
  git('commit', '-qm', 'base', '--no-verify');
});

afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

afterEach(() => {
  git('reset', '-q', '--hard', 'HEAD');
  git('clean', '-qfd');
});

it('passes on a clean staged snapshot', () => {
  for (const name of ['secret_scan', 'missing_tests', 'file_sizes']) expect(check(name).status).toBe(0);
});

it('secret_scan blocks a staged key and never prints its value', () => {
  const key = 'AKIA' + 'Q7XK2LP9RM4TZ8VB';
  put('src/demo/settings.py', `KEY = "${key}"\n`);
  put('tests/test_settings.py', '');
  git('add', '-A');
  const result = check('secret_scan');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('src/demo/settings.py:1');
  expect(result.stderr).not.toContain(key);
});

it('missing_tests blocks a new module without a test', () => {
  put('src/demo/feature.py', 'pass\n');
  git('add', '-A');
  const result = check('missing_tests');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('src/demo/feature.py  ->  tests/*test_feature*.py');
});

it('file_sizes lets an oversized file shrink but not grow (ratchet)', () => {
  put('src/demo/big.py', lines(390));
  git('add', '-A');
  expect(check('file_sizes').status).toBe(0);
  put('src/demo/big.py', lines(401));
  git('add', '-A');
  const result = check('file_sizes');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('src/demo/big.py: 401 lines (was 400)');
});

(hasPytest ? it : it.skip)('the shipped check tests pass in the installed project', () => {
  const result = spawnSync(PYTHON, ['-m', 'pytest', '-q', '-p', 'no:cacheprovider', 'tests'], {
    cwd: tmpDir,
    encoding: 'utf8',
  });
  expect(result.stdout + result.stderr).toMatch(/passed/);
  expect(result.status).toBe(0);
});
