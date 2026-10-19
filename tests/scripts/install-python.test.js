/**
 * Tests for skills/setup/scripts/install-python.js: the Python (uv/pip + ruff + pytest)
 * enforcement fast path. Each test installs into a temp project with --skip-install.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../../skills/setup/scripts/install-python.js');

let tmpDir;

function install(...args) {
  return execFileSync(process.execPath, [SCRIPT, `--target=${tmpDir}`, '--skip-install', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function put(rel, content = '') {
  const file = path.join(tmpDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const read = rel => fs.readFileSync(path.join(tmpDir, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(tmpDir, rel));
const git = (...args) => execFileSync('git', args, { cwd: tmpDir, encoding: 'utf8' }).trim();

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-py-'));
  put('pyproject.toml', '[project]\nname = "demo"\nrequires-python = ">=3.10"\n');
  put('src/demo/__init__.py');
  put('src/demo/core.py', 'X = 1\n');
});

afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe('check scripts', () => {
  it('copies the stdlib checks into scripts/checks and their tests into tests/', () => {
    install();
    for (const file of ['__init__.py', 'config.py', 'git.py', 'secret_scan.py', 'missing_tests.py', 'file_sizes.py']) {
      expect(exists(`scripts/checks/${file}`)).toBe(true);
    }
    for (const file of ['test_checks_secret_scan.py', 'test_checks_missing_tests.py', 'test_checks_file_sizes.py']) {
      expect(exists(`tests/${file}`)).toBe(true);
    }
  });

  it('never overwrites an existing check or test', () => {
    put('scripts/checks/secret_scan.py', '# customized\n');
    install();
    expect(read('scripts/checks/secret_scan.py')).toBe('# customized\n');
  });
});

describe('config.json', () => {
  it('maps a src layout to tests/ and defaults to the ratchet policy', () => {
    install();
    const config = JSON.parse(read('scripts/checks/config.json'));
    expect(config.sizePolicy).toBe('ratchet');
    expect(config.limit).toBe(300);
    expect(config.testMap).toEqual([{ dir: 'src', pattern: 'tests/*test_{stem}*.py' }]);
  });

  it('maps a flat layout to its top-level packages', () => {
    fs.rmSync(path.join(tmpDir, 'src'), { recursive: true });
    put('demo/__init__.py');
    put('tests/__init__.py');
    install();
    expect(JSON.parse(read('scripts/checks/config.json')).testMap).toEqual([
      { dir: 'demo', pattern: 'tests/*test_{stem}*.py' },
    ]);
  });

  it('accepts --size-policy=cap and rejects unknown policies', () => {
    install('--size-policy=cap');
    expect(JSON.parse(read('scripts/checks/config.json')).sizePolicy).toBe('cap');
    expect(() => install('--size-policy=loose')).toThrow(/size-policy/);
  });

  it('keeps an existing config', () => {
    put('scripts/checks/config.json', '{"limit": 400}\n');
    install();
    expect(read('scripts/checks/config.json')).toBe('{"limit": 400}\n');
  });
});

describe('pytest import path', () => {
  it('adds a pytest section with pythonpath so tests can import scripts.checks', () => {
    install();
    expect(read('pyproject.toml')).toMatch(/\n\[tool\.pytest\.ini_options\]\npythonpath = \["\."\]\n$/);
  });

  it('adds pythonpath under an existing pytest section', () => {
    put('pyproject.toml', '[project]\nname = "demo"\n\n[tool.pytest.ini_options]\naddopts = "-q"\n');
    install();
    expect(read('pyproject.toml')).toContain('[tool.pytest.ini_options]\npythonpath = ["."]\naddopts = "-q"\n');
  });

  it('leaves an existing pythonpath alone and points at what to add', () => {
    const text = '[project]\nname = "demo"\n\n[tool.pytest.ini_options]\npythonpath = ["src"]\n';
    put('pyproject.toml', text);
    expect(install()).toMatch(/Add "\." to pythonpath/);
    expect(read('pyproject.toml')).toBe(text);
  });
});

describe('git hooks', () => {
  it('writes executable .githooks using uv when the project uses uv', () => {
    put('uv.lock');
    install();
    for (const hook of ['pre-commit', 'pre-push']) {
      expect(fs.statSync(path.join(tmpDir, '.githooks', hook)).mode & 0o111).not.toBe(0);
    }
    expect(read('.githooks/pre-commit')).toMatch(/^RUN="uv run --quiet"$/m);
    expect(read('.githooks/pre-commit')).toContain('$RUN python -m scripts.checks.secret_scan');
    expect(read('.githooks/pre-push')).toContain('$RUN pytest');
  });

  it('runs tools directly when the project does not use uv', () => {
    install();
    expect(read('.githooks/pre-commit')).toMatch(/^RUN=""$/m);
  });

  it('activates the hooks in a git repository', () => {
    git('init', '-q');
    install();
    expect(git('config', 'core.hooksPath')).toBe('.githooks');
  });

  it('leaves another hooks manager in place and says so', () => {
    git('init', '-q');
    git('config', 'core.hooksPath', '.husky');
    expect(install()).toMatch(/core\.hooksPath is already "\.husky"/);
    expect(git('config', 'core.hooksPath')).toBe('.husky');
  });
});

describe('agent config', () => {
  it('copies Python rules and settings without overwriting', () => {
    put('.claude/rules/tdd.md', 'mine\n');
    install();
    expect(read('.claude/rules/tdd.md')).toBe('mine\n');
    for (const rule of ['code-quality.md', 'testing.md', 'python.md']) {
      expect(read(`.claude/rules/${rule}`)).toMatch(/^---\nglobs:/);
    }
    expect(JSON.parse(read('.claude/settings.json')).permissions.allow).toContain('Bash(uv run pytest:*)');
  });

  it('adds only missing Python ignore patterns', () => {
    put('.gitignore', '.venv/\n');
    install();
    const lines = read('.gitignore').split('\n');
    expect(lines.filter(line => line === '.venv/')).toHaveLength(1);
    expect(lines).toEqual(expect.arrayContaining(['__pycache__/', '.pytest_cache/', '.env']));
    install();
    expect(read('.gitignore').split('\n').filter(line => line === '__pycache__/')).toHaveLength(1);
  });
});

describe('documentation', () => {
  it('installs the documentation engine over the detected source roots', () => {
    put('scripts/tool.py', 'pass\n');
    install('--folder-notes');
    expect(exists('scripts/self-documentation/generate.js')).toBe(true);
    const config = JSON.parse(read('documentation.config.json'));
    expect(config.sourceRoots).toEqual(['src', 'scripts']);
    expect(config.folderNotes).toBe(true);
    expect(config.exclude).toContain('scripts/self-documentation');
  });
});

describe('arguments', () => {
  it('requires a Python project', () => {
    fs.rmSync(path.join(tmpDir, 'pyproject.toml'));
    expect(() => install()).toThrow(/pyproject\.toml/);
  });
});
