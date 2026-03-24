#!/usr/bin/env node
/**
 * Setup Skill Grader — validates /setup output against setup-eval-config.json.
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
  const msg = 'Missing required arguments';
  console.log(JSON.stringify({ pass: false, score: '0/0', details: msg }));
  process.exit(0);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const testCase = config.test_cases.find((tc) => tc.name === testCaseName);

if (!testCase) {
  const msg = `Test case '${testCaseName}' not found`;
  console.log(JSON.stringify({ pass: false, score: '0/0', details: msg }));
  process.exit(0);
}

const expected = testCase.expected;
const checks = [];

function check(name, pass, detail) {
  checks.push({ name, pass: Boolean(pass), detail: detail || '' });
}

function pathExists(p) {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
}

function isExecutable(p) {
  try {
    const stat = fs.statSync(p);
    return (stat.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

// ─── 0. Setup report ───
const reportPath = path.join(fixtureDir, '.claude/setup-report.md');
let reportFrontmatter = {};
check('Setup report created', pathExists(reportPath));
if (pathExists(reportPath)) {
  const fmMatch = fs.readFileSync(reportPath, 'utf8').match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    check('Report has YAML frontmatter', true);
    for (const line of fmMatch[1].split('\n')) {
      const kv = line.match(/^(\w[\w_-]*)\s*:\s*(.+)$/);
      if (kv) reportFrontmatter[kv[1]] = kv[2].trim();
    }
    check('Report has stack', !!reportFrontmatter.stack, reportFrontmatter.stack || 'Missing');
    check('Report status complete', reportFrontmatter.status === 'complete', reportFrontmatter.status || 'Missing');
  } else {
    check('Report has YAML frontmatter', false, 'No --- delimiters');
  }
}

// ─── 1. Required files must exist ───
for (const filePath of expected.files_must_exist || []) {
  const fullPath = path.join(fixtureDir, filePath);
  const exists = pathExists(fullPath);
  check(`Required file: ${filePath}`, exists, exists ? '' : 'Not found');
}

// ─── 2. Recommended files (soft checks, still counted) ───
for (const filePath of expected.files_should_exist || []) {
  const fullPath = path.join(fixtureDir, filePath);
  const exists = pathExists(fullPath);
  check(`Recommended file: ${filePath}`, exists, exists ? '' : 'Not found');
}

// ─── 3. JSON validity ───
for (const filePath of expected.json_valid || []) {
  const fullPath = path.join(fixtureDir, filePath);
  if (!pathExists(fullPath)) {
    check(`JSON valid: ${filePath}`, false, 'File not found');
    continue;
  }
  try {
    JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    check(`JSON valid: ${filePath}`, true);
  } catch (err) {
    check(`JSON valid: ${filePath}`, false, err.message);
  }
}

// ─── 4. Hook executability (checks .git/hooks/ and .husky/) ───
for (const filePath of expected.hooks_executable || []) {
  const hookName = path.basename(filePath);
  const gitHook = path.join(fixtureDir, '.git', 'hooks', hookName);
  const huskyHook = path.join(fixtureDir, '.husky', hookName);
  const foundGit = pathExists(gitHook) && isExecutable(gitHook);
  const foundHusky = pathExists(huskyHook);
  const found = foundGit || foundHusky;
  check(
    `Hook exists: ${hookName}`,
    found,
    found ? (foundHusky ? '.husky/' : '.git/hooks/') : 'Not in .git/hooks/ or .husky/',
  );
}

// ─── 5. CLAUDE.md sections ───
const claudeMdPath = path.join(fixtureDir, 'CLAUDE.md');
if (pathExists(claudeMdPath)) {
  const claudeMd = fs.readFileSync(claudeMdPath, 'utf8').toLowerCase();
  for (const section of expected.claude_md_sections || []) {
    const found = claudeMd.includes(section.toLowerCase());
    check(
      `CLAUDE.md has "${section}" section`,
      found,
      found ? '' : `Section "${section}" not found`,
    );
  }
} else if ((expected.claude_md_sections || []).length > 0) {
  check('CLAUDE.md exists for section checks', false, 'CLAUDE.md not found');
}

// ─── 6. Settings allow/deny structure ───
if (expected.settings_has_allow_deny) {
  const settingsPath = path.join(fixtureDir, '.claude/settings.json');
  if (!pathExists(settingsPath)) {
    check('Settings has allow/deny lists', false, 'settings.json not found');
  } else {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const perms = settings.permissions || {};
      const hasAllow = Array.isArray(perms.allow) && perms.allow.length > 0;
      const hasDeny = Array.isArray(perms.deny) && perms.deny.length > 0;
      check(
        'Settings has allow list',
        hasAllow,
        hasAllow ? `${perms.allow.length} entries` : 'Missing or empty',
      );
      check(
        'Settings has deny list',
        hasDeny,
        hasDeny ? `${perms.deny.length} entries` : 'Missing or empty',
      );
    } catch (err) {
      check('Settings has allow/deny lists', false, err.message);
    }
  }
}

// ─── 7. Rule files have globs: frontmatter ───
if (expected.rules_have_globs_frontmatter) {
  const rulesDir = path.join(fixtureDir, '.claude/rules');
  if (!pathExists(rulesDir)) {
    check('Rules directory exists', false, '.claude/rules/ not found');
  } else {
    const ruleFiles = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.md'));
    if (ruleFiles.length === 0) {
      check('Rules directory has .md files', false, 'No .md files found');
    }
    for (const ruleFile of ruleFiles) {
      const content = fs.readFileSync(path.join(rulesDir, ruleFile), 'utf8');
      const hasFrontmatter = /^---\n[\s\S]*?globs:/m.test(content);
      check(
        `Rule ${ruleFile} has globs: frontmatter`,
        hasFrontmatter,
        hasFrontmatter ? '' : 'Missing globs: in frontmatter',
      );
    }
  }
}

// ─── 8. Auto-documentation pipeline ───
if (expected.auto_doc_pipeline) {
  const gdPath = path.join(fixtureDir, 'scripts/generate-docs.js');
  const ghPath = path.join(fixtureDir, 'scripts/generate-docs-helpers.js');
  check('Auto-doc: generate-docs.js exists', pathExists(gdPath), pathExists(gdPath) ? '' : 'Not found');
  check('Auto-doc: helpers exists', pathExists(ghPath), pathExists(ghPath) ? '' : 'Not found');

  const gitHook = path.join(fixtureDir, '.git/hooks/pre-commit');
  const huskyHook = path.join(fixtureDir, '.husky/pre-commit');
  const hookFile = pathExists(gitHook) ? gitHook : pathExists(huskyHook) ? huskyHook : null;
  const hookOk = hookFile && /generate-docs/i.test(fs.readFileSync(hookFile, 'utf8'));
  check('Auto-doc: hook runs generate-docs', hookOk, hookOk ? '' : 'Not found or missing reference');

  const cPath = path.join(fixtureDir, 'CLAUDE.md');
  if (pathExists(cPath)) {
    const c = fs.readFileSync(cPath, 'utf8');
    check('Auto-doc: AUTO:tree marker', /<!--\s*AUTO:tree\s*-->/.test(c));
    check('Auto-doc: AUTO:modules marker', /<!--\s*AUTO:modules\s*-->/.test(c));
  } else {
    check('Auto-doc: CLAUDE.md has AUTO markers', false, 'CLAUDE.md not found');
  }
}

// ─── 9. Docs index auto-generation ───
if (expected.docs_index_generated) {
  const docsDir = path.join(fixtureDir, 'docs');
  const docsExists = pathExists(docsDir);
  check(
    'Docs index: docs/ directory exists',
    docsExists,
    docsExists ? '' : 'docs/ not created by setup',
  );

  if (docsExists) {
    const indexPath = path.join(docsDir, 'index.md');
    const indexExists = pathExists(indexPath);
    check(
      'Docs index: docs/index.md exists',
      indexExists,
      indexExists ? '' : 'docs/index.md not generated',
    );
  }
}

// ─── 10. Existing files preserved ───
for (const filePath of expected.existing_files_preserved || []) {
  const fullPath = path.join(fixtureDir, filePath);
  const exists = pathExists(fullPath);
  check(
    `Preserved: ${filePath}`,
    exists,
    exists ? '' : 'Original file was deleted',
  );
}

// ─── 11. CLAUDE.md content checks (more reliable than conversation) ───
if (pathExists(claudeMdPath)) {
  const claudeContent = fs.readFileSync(claudeMdPath, 'utf8').toLowerCase();
  for (const term of expected.claude_md_must_mention || []) {
    const found = claudeContent.includes(term.toLowerCase());
    check(
      `CLAUDE.md mentions "${term}"`,
      found,
      found ? '' : `Term "${term}" not found in CLAUDE.md`,
    );
  }
  for (const term of expected.claude_md_must_not_mention || []) {
    const found = claudeContent.includes(term.toLowerCase());
    check(
      `CLAUDE.md does NOT mention "${term}"`,
      !found,
      found ? `Found forbidden term "${term}" in CLAUDE.md` : '',
    );
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
