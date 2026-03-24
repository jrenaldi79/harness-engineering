/**
 * Tests for scripts/release.sh — validates version bumping, changelog
 * checking, and tag creation in the release workflow.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync, execSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../../scripts/release.sh');

let tmpDir;

function run(args, opts = {}) {
  return execSync(`bash ${SCRIPT} ${args}`, {
    cwd: opts.cwd || tmpDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  });
}

const GIT_INIT = [
  'git init -q',
  'git config user.email "test@test.com"',
  'git config user.name "Test"',
  'git config commit.gpgsign false',
  'git config tag.gpgsign false',
].join(' && ');

function setupRepo() {
  execSync(`${GIT_INIT} && git add -A && git commit -q -m "init"`, {
    cwd: tmpDir,
  });
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-'));
  fs.mkdirSync(path.join(tmpDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, '.claude-plugin/plugin.json'),
    JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2),
  );
  fs.writeFileSync(
    path.join(tmpDir, 'CHANGELOG.md'),
    [
      '# Changelog',
      '',
      '## [1.0.0] - 2026-03-24',
      '',
      '### Added',
      '',
      '- Initial release',
      '',
    ].join('\n'),
  );
  setupRepo();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
describe('validation', () => {
  it('fails without a version argument', () => {
    expect(() => run('')).toThrow();
  });

  it('fails with invalid semver', () => {
    expect(() => run('abc')).toThrow();
  });

  it('fails if version is not higher than current', () => {
    expect(() => run('0.9.0')).toThrow();
  });

  it('fails if version equals current', () => {
    expect(() => run('1.0.0')).toThrow();
  });

  it('fails if CHANGELOG.md has no entry for the new version', () => {
    try {
      run('2.0.0');
      throw new Error('Should have thrown');
    } catch (err) {
      const output = (err.stderr || '') + (err.stdout || '') + (err.message || '');
      expect(output.toLowerCase()).toContain('changelog');
    }
  });
});

// ---------------------------------------------------------------------------
// Dry run
// ---------------------------------------------------------------------------
describe('--dry-run', () => {
  it('shows what would happen without making changes', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'CHANGELOG.md'),
      [
        '# Changelog',
        '',
        '## [1.1.0] - 2026-03-24',
        '',
        '### Added',
        '- New feature',
        '',
        '## [1.0.0] - 2026-03-24',
        '',
        '### Added',
        '- Initial release',
      ].join('\n'),
    );
    execSync('git add -A && git -c commit.gpgsign=false commit -q -m "add changelog"', { cwd: tmpDir });

    const output = run('1.1.0 --dry-run');
    expect(output).toContain('1.1.0');
    expect(output).toMatch(/dry.run/i);

    // plugin.json should NOT be modified
    const plugin = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.claude-plugin/plugin.json'), 'utf8'),
    );
    expect(plugin.version).toBe('1.0.0');
  });
});

// ---------------------------------------------------------------------------
// Actual release
// ---------------------------------------------------------------------------
describe('release', () => {
  beforeEach(() => {
    fs.writeFileSync(
      path.join(tmpDir, 'CHANGELOG.md'),
      [
        '# Changelog',
        '',
        '## [1.1.0] - 2026-03-24',
        '',
        '### Added',
        '- New feature',
        '',
        '## [1.0.0] - 2026-03-24',
        '',
        '### Added',
        '- Initial release',
      ].join('\n'),
    );
    execSync('git add -A && git -c commit.gpgsign=false commit -q -m "add changelog"', { cwd: tmpDir });
  });

  it('bumps plugin.json version', () => {
    run('1.1.0');
    const plugin = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.claude-plugin/plugin.json'), 'utf8'),
    );
    expect(plugin.version).toBe('1.1.0');
  });

  it('creates a git tag', () => {
    run('1.1.0');
    const tags = execSync('git tag', { cwd: tmpDir, encoding: 'utf8' });
    expect(tags.trim()).toContain('v1.1.0');
  });

  it('creates a commit with the version bump', () => {
    run('1.1.0');
    const log = execSync('git log --oneline -1', { cwd: tmpDir, encoding: 'utf8' });
    expect(log).toContain('1.1.0');
  });

  it('tag points to the release commit', () => {
    run('1.1.0');
    const tagSha = execSync('git rev-parse v1.1.0', { cwd: tmpDir, encoding: 'utf8' }).trim();
    const headSha = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf8' }).trim();
    expect(tagSha).toBe(headSha);
  });

  it('does not push by default', () => {
    // No remote configured — push would fail if attempted
    run('1.1.0');
    // If we got here without error, no push was attempted
  });
});
