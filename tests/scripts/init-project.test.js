/**
 * Tests for skills/setup/scripts/init-project.js
 *
 * Uses a temp directory per test and the --skip-install flag to avoid
 * running npm install during testing.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../../skills/setup/scripts/init-project.js');

/** Run init-project.js as a child process with given args. */
function runScript(args, cwd) {
  return execFileSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'init-proj-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// --name flag: creates project directory
// ---------------------------------------------------------------------------
describe('--name flag', () => {
  it('creates the project directory and scaffolds it', () => {
    runScript(['--name=myapp', '--framework=none', '--skip-install'], tmpDir);

    const projectDir = path.join(tmpDir, 'myapp');
    expect(fs.existsSync(projectDir)).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'src'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'tests'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'scripts'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'docs'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, '.git'))).toBe(true);
  });

  it('uses the project name in package.json', () => {
    runScript(['--name=coolproject', '--framework=none', '--skip-install'], tmpDir);

    const pkg = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'coolproject', 'package.json'), 'utf8')
    );
    expect(pkg.name).toBe('coolproject');
    expect(pkg.version).toBe('1.0.0');
  });
});

// ---------------------------------------------------------------------------
// --in-place: uses name for package.json but stays in current directory
// ---------------------------------------------------------------------------
describe('--in-place flag', () => {
  it('scaffolds in current directory, not a subdirectory', () => {
    runScript(['--name=myapp', '--framework=none', '--skip-install', '--in-place'], tmpDir);

    expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'myapp'))).toBe(false);
  });

  it('uses the --name value in package.json', () => {
    runScript(['--name=myapp', '--framework=none', '--skip-install', '--in-place'], tmpDir);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('myapp');
  });
});

// ---------------------------------------------------------------------------
// No --name: initializes in current directory
// ---------------------------------------------------------------------------
describe('no --name flag', () => {
  it('initializes in the current directory using directory name', () => {
    runScript(['--framework=none', '--skip-install'], tmpDir);

    expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'tests'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'scripts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs'))).toBe(true);
  });

  it('uses the current directory name as package name', () => {
    const namedDir = path.join(tmpDir, 'my-service');
    fs.mkdirSync(namedDir);
    runScript(['--framework=none', '--skip-install'], namedDir);

    const pkg = JSON.parse(fs.readFileSync(path.join(namedDir, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('my-service');
  });
});

// ---------------------------------------------------------------------------
// TypeScript devDependencies always present
// ---------------------------------------------------------------------------
describe('TypeScript devDependencies', () => {
  it('always includes typescript and @types/node', () => {
    runScript(['--framework=none', '--skip-install'], tmpDir);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
    expect(pkg.devDependencies).toHaveProperty('typescript');
    expect(pkg.devDependencies).toHaveProperty('@types/node');
  });
});

// ---------------------------------------------------------------------------
// Does not overwrite existing package.json
// ---------------------------------------------------------------------------
describe('existing package.json', () => {
  it('does not overwrite an existing package.json', () => {
    const existingPkg = { name: 'preexisting', version: '2.0.0', custom: 'value' };
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify(existingPkg, null, 2)
    );

    runScript(['--framework=express', '--skip-install'], tmpDir);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('preexisting');
    expect(pkg.version).toBe('2.0.0');
    expect(pkg.custom).toBe('value');
  });
});

// ---------------------------------------------------------------------------
// Framework dependencies
// ---------------------------------------------------------------------------
describe('framework dependencies', () => {
  it('adds express to dependencies for --framework=express', () => {
    runScript(['--framework=express', '--skip-install'], tmpDir);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
    expect(pkg.dependencies).toHaveProperty('express');
    expect(pkg.devDependencies).toHaveProperty('@types/express');
  });

  it('adds fastify to dependencies for --framework=fastify', () => {
    runScript(['--framework=fastify', '--skip-install'], tmpDir);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
    expect(pkg.dependencies).toHaveProperty('fastify');
  });

  it('adds vite and react for --framework=vite', () => {
    runScript(['--framework=vite', '--skip-install'], tmpDir);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
    expect(pkg.dependencies).toHaveProperty('vite');
    expect(pkg.dependencies).toHaveProperty('react');
    expect(pkg.dependencies).toHaveProperty('react-dom');
    expect(pkg.dependencies).toHaveProperty('@vitejs/plugin-react');
    expect(pkg.devDependencies).toHaveProperty('@types/react');
  });

  it('adds next, react, react-dom for --framework=nextjs', () => {
    runScript(['--framework=nextjs', '--skip-install'], tmpDir);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
    expect(pkg.dependencies).toHaveProperty('next');
    expect(pkg.dependencies).toHaveProperty('react');
    expect(pkg.dependencies).toHaveProperty('react-dom');
    expect(pkg.devDependencies).toHaveProperty('@types/react');
  });

  it('has no deps for --framework=none', () => {
    runScript(['--framework=none', '--skip-install'], tmpDir);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
    expect(Object.keys(pkg.dependencies || {})).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// git init
// ---------------------------------------------------------------------------
describe('git init', () => {
  it('runs git init when no .git directory exists', () => {
    runScript(['--framework=none', '--skip-install'], tmpDir);
    expect(fs.existsSync(path.join(tmpDir, '.git'))).toBe(true);
  });

  it('does not fail when .git already exists', () => {
    execFileSync('git', ['init'], { cwd: tmpDir });
    expect(() => {
      runScript(['--framework=none', '--skip-install'], tmpDir);
    }).not.toThrow();
  });
});
