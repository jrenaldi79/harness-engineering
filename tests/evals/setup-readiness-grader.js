#!/usr/bin/env node
/**
 * Setup-then-Readiness Grader — validates that /setup produces a project
 * that /readiness scores at Level 3+.
 */

const fs = require('fs');
const path = require('path');

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace('--', '')] = process.argv[i + 1];
}

const {
  config: configPath,
  'test-case': testCaseName,
  'result-dir': resultDir,
  'fixture-dir': fixtureDir,
} = args;

if (!configPath || !testCaseName || !resultDir || !fixtureDir) {
  console.log(JSON.stringify({ pass: false, score: '0/0', details: 'Missing args' }));
  process.exit(0);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const testCase = config.test_cases.find((tc) => tc.name === testCaseName);

if (!testCase) {
  console.log(JSON.stringify({ pass: false, score: '0/0', details: `Test case '${testCaseName}' not found` }));
  process.exit(0);
}

const expected = testCase.expected;
const checks = [];

function check(name, pass, detail) {
  checks.push({ name, pass: Boolean(pass), detail: detail || '' });
}

function pathExists(p) {
  try { fs.statSync(p); return true; } catch { return false; }
}

// ─── 1. Setup files exist ───
for (const filePath of expected.setup_files_exist || []) {
  const exists = pathExists(path.join(fixtureDir, filePath));
  check(`Setup created: ${filePath}`, exists, exists ? '' : 'Not found');
}

// ─── 2. Readiness report created ───
const reportPath = path.join(fixtureDir, 'readiness-report.md');
const reportExists = pathExists(reportPath);
check('Readiness report created', reportExists, reportExists ? '' : 'Not found');

// ─── 3. Readiness level meets minimum ───
if (reportExists && expected.readiness_level) {
  const report = fs.readFileSync(reportPath, 'utf8');
  const fmMatch = report.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const frontmatter = {};
    for (const line of fmMatch[1].split('\n')) {
      const kv = line.match(/^(\w[\w_-]*)\s*:\s*(.+)$/);
      if (kv) frontmatter[kv[1]] = kv[2].trim();
    }
    const level = parseInt(frontmatter.level, 10);
    const minLevel = expected.readiness_level.min || 1;
    check(
      `Readiness level >= ${minLevel}`,
      level >= minLevel,
      level >= minLevel ? `Level ${level}` : `Level ${level} < ${minLevel}`,
    );
    check('Report has YAML frontmatter', true);
  } else {
    check('Report has YAML frontmatter', false, 'No --- delimiters');
  }
}

// ─── Output ───
const passed = checks.filter((c) => c.pass).length;
const total = checks.length;
const allPass = passed === total;

console.log(
  JSON.stringify({
    pass: allPass,
    score: `${passed}/${total}`,
    details: allPass
      ? 'All checks passed'
      : checks
          .filter((c) => !c.pass)
          .map((c) => `${c.name}: ${c.detail}`)
          .join('; '),
    checks,
  }),
);
