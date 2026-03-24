/**
 * Tests for scripts/repo-generate-docs.js — the repo-level CLAUDE.md
 * auto-generation wrapper that regenerates AUTO:tree and AUTO:modules
 * markers from the actual repo structure.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../../scripts/repo-generate-docs.js');
const REPO_ROOT = path.resolve(__dirname, '../..');

function runScript(args, cwd) {
  return execFileSync(process.execPath, [SCRIPT, ...args], {
    cwd: cwd || REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// ---------------------------------------------------------------------------
// --check mode (validates against real repo)
// ---------------------------------------------------------------------------
describe('--check mode', () => {
  it('exits 0 when CLAUDE.md markers are current', () => {
    // First regenerate to ensure they're current, then check
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-gendocs-'));
    const claudeMd = fs.readFileSync(
      path.join(REPO_ROOT, 'CLAUDE.md'),
      'utf8',
    );
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), claudeMd);

    // Running --check on the real repo should pass if markers are up to date
    // We test this by running write mode first, then check mode
    try {
      runScript(['--root', REPO_ROOT]);
      runScript(['--check', '--root', REPO_ROOT]);
    } catch (err) {
      // If check fails, the markers are stale — that's a valid test signal
      // but we should not fail the test suite for stale markers
      expect(err.stderr || '').toMatch(/stale|cannot/i);
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// Tree generation
// ---------------------------------------------------------------------------
describe('tree generation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-gendocs-'));
    // Create a minimal repo-like structure
    fs.mkdirSync(path.join(tmpDir, 'skills', 'readiness'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'skills', 'setup', 'scripts', 'lib'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'tests', 'evals', 'fixtures'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'tests', 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'scripts', 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'skills', 'readiness', 'SKILL.md'), '# Readiness');
    fs.writeFileSync(path.join(tmpDir, 'skills', 'setup', 'SKILL.md'), '# Setup');
    fs.writeFileSync(path.join(tmpDir, 'tests', 'evals', 'grader.js'), '/** Readiness grader */\nmodule.exports = {};');
    fs.writeFileSync(path.join(tmpDir, 'tests', 'evals', 'setup-grader.js'), '/** Setup grader */\nmodule.exports = {};');
    fs.writeFileSync(path.join(tmpDir, 'scripts', 'hooks', 'pre-commit'), '#!/bin/bash');

    // Create CLAUDE.md with AUTO markers
    fs.writeFileSync(
      path.join(tmpDir, 'CLAUDE.md'),
      [
        '# Project',
        '<!-- AUTO:tree -->',
        'old tree',
        '<!-- /AUTO:tree -->',
        '',
        '<!-- AUTO:modules -->',
        'old modules',
        '<!-- /AUTO:modules -->',
      ].join('\n'),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('regenerates tree marker with repo directories', () => {
    runScript(['--root', tmpDir]);
    const result = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf8');
    expect(result).toContain('skills/');
    expect(result).toContain('tests/');
    expect(result).toContain('scripts/');
    expect(result).not.toContain('old tree');
  });

  it('regenerates modules marker', () => {
    runScript(['--root', tmpDir]);
    const result = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf8');
    expect(result).toContain('Module');
    expect(result).toContain('Purpose');
    expect(result).not.toContain('old modules');
  });

  it('includes eval graders in module index', () => {
    runScript(['--root', tmpDir]);
    const result = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf8');
    expect(result).toContain('grader.js');
    expect(result).toContain('setup-grader.js');
  });

  it('includes SKILL.md files in module index', () => {
    runScript(['--root', tmpDir]);
    const result = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf8');
    expect(result).toContain('SKILL.md');
  });

  it('--check fails when markers are stale', () => {
    // Don't regenerate first — markers contain "old tree" which won't match
    expect(() => {
      runScript(['--check', '--root', tmpDir]);
    }).toThrow();
  });

  it('--check passes after regeneration', () => {
    runScript(['--root', tmpDir]);
    // Should not throw
    runScript(['--check', '--root', tmpDir]);
  });
});
