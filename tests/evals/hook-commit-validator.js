/**
 * Hook-driven commit validation for setup eval grader.
 *
 * After /setup completes, simulates a real user committing code:
 * 1. Copies hook from .husky/ to .git/hooks/, strips lint-staged, adds set -e
 * 2. Stages file with secret → git commit should fail
 * 3. Stages clean file with test → git commit should succeed
 * 4. Verifies CLAUDE.md auto-updated with new file
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function pathExists(p) {
  try { fs.statSync(p); return true; } catch { return false; }
}

/**
 * Run hook-driven commit validation against a fixture directory.
 * @param {string} fixtureDir - Path to the fixture (must be a git repo)
 * @returns {Array<{name: string, pass: boolean, detail: string}>}
 */
function validateHookCommits(fixtureDir) {
  const checks = [];
  function check(name, pass, detail) {
    checks.push({ name, pass: Boolean(pass), detail: detail || '' });
  }

  const huskyHook = path.join(fixtureDir, '.husky/pre-commit');
  const gitHook = path.join(fixtureDir, '.git/hooks/pre-commit');

  // Step 0: Prepare hook for native git
  let hookReady = false;
  if (pathExists(huskyHook) || pathExists(gitHook)) {
    try {
      const src = pathExists(huskyHook) ? huskyHook : gitHook;
      let content = fs.readFileSync(src, 'utf8');
      content = content.replace(/^npx lint-staged.*$/m, '');
      if (!content.includes('set -e')) {
        content = content.replace('#!/usr/bin/env bash', '#!/usr/bin/env bash\nset -e');
      }
      fs.mkdirSync(path.dirname(gitHook), { recursive: true });
      fs.writeFileSync(gitHook, content);
      fs.chmodSync(gitHook, 0o755);
      // Remove .husky/pre-commit to prevent double-execution via husky runner
      if (pathExists(huskyHook)) {
        try { fs.unlinkSync(huskyHook); } catch { /* ok */ }
      }
      hookReady = true;
    } catch (e) {
      check('Hook commit: prepare hook', false, e.message);
    }
  }

  if (!hookReady) {
    check('Hook commit: hook not found', false, 'No pre-commit hook in .husky/ or .git/hooks/');
    return checks;
  }

  try {
    execFileSync('git', ['config', 'user.name', 'EvalTest'], { cwd: fixtureDir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'eval@test.com'], { cwd: fixtureDir, stdio: 'ignore' });
    execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: fixtureDir, stdio: 'ignore' });

    // Step 1: Bad commit — secret
    const badDir = path.join(fixtureDir, 'src', 'sub');
    fs.mkdirSync(badDir, { recursive: true });
    fs.writeFileSync(path.join(badDir, 'secret.js'), 'const k = "sk-ant-evaltest123456";\n');
    fs.writeFileSync(path.join(badDir, 'secret.test.js'), 'test("ok", () => {});\n');
    execFileSync('git', ['add', '-A'], { cwd: fixtureDir, stdio: 'ignore' });

    let blocked = false;
    let blockErr = '';
    try {
      execFileSync('git', ['commit', '-m', 'bad-secret'], { cwd: fixtureDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      blocked = true;
      blockErr = (e.stderr || e.stdout || '').slice(0, 200);
    }
    check('Hook blocks secret commit', blocked, blocked ? blockErr : 'Commit with secret was not blocked');

    // Step 2: Good commit — clean file
    fs.unlinkSync(path.join(badDir, 'secret.js'));
    fs.unlinkSync(path.join(badDir, 'secret.test.js'));
    fs.writeFileSync(path.join(badDir, 'service.js'), '/** Service */\nmodule.exports = { run() {} };\n');
    fs.writeFileSync(path.join(badDir, 'service.test.js'), 'test("ok", () => {});\n');
    execFileSync('git', ['add', '-A'], { cwd: fixtureDir, stdio: 'ignore' });

    let ok = false;
    let commitErr = '';
    try {
      execFileSync('git', ['commit', '-m', 'clean-code'], { cwd: fixtureDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      ok = true;
    } catch (e) {
      commitErr = (e.stderr || e.stdout || e.message || '').slice(0, 300);
    }
    check('Hook allows clean commit', ok, ok ? '' : `Blocked: ${commitErr}`);

    // Step 3: Verify auto-doc
    if (ok) {
      const claudePath = path.join(fixtureDir, 'CLAUDE.md');
      if (pathExists(claudePath)) {
        const doc = fs.readFileSync(claudePath, 'utf8');
        const found = doc.includes('service.js');
        check('Hook auto-updated CLAUDE.md', found, found ? '' : 'service.js not found in CLAUDE.md');
      } else {
        check('Hook auto-updated CLAUDE.md', false, 'CLAUDE.md not found');
      }
    }
  } catch (e) {
    check('Hook commit validation', false, e.message);
  }

  return checks;
}

module.exports = { validateHookCommits };
