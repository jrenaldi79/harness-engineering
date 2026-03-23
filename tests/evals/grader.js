#!/usr/bin/env node
/**
 * Readiness Skill Grader
 *
 * Validates the readiness report output against expected criteria
 * defined in eval-config.json.
 *
 * Usage:
 *   node grader.js --config eval-config.json --test-case level-1-bare --result-dir ./results/... --fixture-dir /tmp/...
 */

const fs = require('fs');
const path = require('path');

// Parse CLI args
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace('--', '')] = process.argv[i + 1];
}

const { config: configPath, 'test-case': testCaseName, 'result-dir': resultDir, 'fixture-dir': fixtureDir } = args;

if (!configPath || !testCaseName || !resultDir) {
  console.error(JSON.stringify({ pass: false, score: '0/0', details: 'Missing required arguments' }));
  process.exit(0);
}

// Load config and find test case
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const testCase = config.test_cases.find((tc) => tc.name === testCaseName);

if (!testCase) {
  console.error(JSON.stringify({ pass: false, score: '0/0', details: `Test case '${testCaseName}' not found` }));
  process.exit(0);
}

const expected = testCase.expected;
const checks = [];

// ─── Helper ───
function check(name, pass, detail) {
  checks.push({ name, pass, detail: detail || '' });
}

// ─── 1. Report file exists ───
const reportPath = path.join(resultDir, 'readiness-report.md');
const reportExists = fs.existsSync(reportPath);
check('Report file created', reportExists === expected.report_file_created);

if (!reportExists) {
  // Can't grade further without the report
  const passed = checks.filter((c) => c.pass).length;
  console.log(
    JSON.stringify({
      pass: false,
      score: `${passed}/${checks.length}`,
      details: 'Report file was not created — cannot grade further',
      checks,
    }),
  );
  process.exit(0);
}

// ─── 2. Parse YAML frontmatter ───
const reportContent = fs.readFileSync(reportPath, 'utf8');
let frontmatter = {};
let reportBody = reportContent;

const fmMatch = reportContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (fmMatch) {
  // Simple YAML parser for the frontmatter (handles our known structure)
  const yamlStr = fmMatch[1];
  reportBody = fmMatch[2];
  frontmatter = parseSimpleYaml(yamlStr);
  check('YAML frontmatter present', true);
} else {
  check('YAML frontmatter present', false, 'No --- delimiters found');
}

// Check required frontmatter fields
if (expected.yaml_frontmatter) {
  for (const field of expected.yaml_frontmatter.required_fields || []) {
    const hasField = frontmatter[field] !== undefined;
    check(`Frontmatter has '${field}'`, hasField, hasField ? '' : `Missing field: ${field}`);
  }
}

// ─── 3. Level check ───
const reportedLevel = parseInt(frontmatter.level, 10);
if (expected.level) {
  const levelOk = !isNaN(reportedLevel) && reportedLevel >= expected.level.min && reportedLevel <= expected.level.max;
  check(
    `Level in range [${expected.level.min}, ${expected.level.max}]`,
    levelOk,
    `Got level: ${reportedLevel}`,
  );
}

// ─── 4. Pillar scores ───
if (expected.pillars && frontmatter.pillars) {
  for (const [pillarName, criteria] of Object.entries(expected.pillars)) {
    const pillar = frontmatter.pillars[pillarName];
    if (!pillar) {
      check(`Pillar '${pillarName}' reported`, false, 'Pillar not found in frontmatter');
      continue;
    }

    const passCount = parseInt(pillar.pass, 10) || 0;

    if (criteria.pass_min !== undefined) {
      check(
        `${pillarName}: pass >= ${criteria.pass_min}`,
        passCount >= criteria.pass_min,
        `Got ${passCount}`,
      );
    }
    if (criteria.pass_max !== undefined) {
      check(
        `${pillarName}: pass <= ${criteria.pass_max}`,
        passCount <= criteria.pass_max,
        `Got ${passCount}`,
      );
    }
  }
}

// ─── 5. Recommendations content checks ───
if (expected.recommendations) {
  // Combine conversation + report body for recommendation checks
  const conversationPath = path.join(resultDir, 'conversation.txt');
  const conversation = fs.existsSync(conversationPath) ? fs.readFileSync(conversationPath, 'utf8') : '';
  const fullText = (reportBody + '\n' + conversation).toLowerCase();

  for (const term of expected.recommendations.must_mention || []) {
    check(
      `Recommends: "${term}"`,
      fullText.includes(term.toLowerCase()),
      fullText.includes(term.toLowerCase()) ? '' : `Term '${term}' not found in output`,
    );
  }

  for (const term of expected.recommendations.must_not_mention || []) {
    check(
      `Does NOT recommend: "${term}"`,
      !fullText.includes(term.toLowerCase()),
      fullText.includes(term.toLowerCase()) ? `Found forbidden term '${term}'` : '',
    );
  }
}

// ─── 6. Insight detection checks ───
if (expected.insights) {
  const conversationPath = path.join(resultDir, 'conversation.txt');
  const conversation = fs.existsSync(conversationPath) ? fs.readFileSync(conversationPath, 'utf8') : '';
  const fullText = (reportBody + '\n' + conversation).toLowerCase();

  for (const insight of expected.insights.must_detect || []) {
    check(
      `Detects: "${insight}"`,
      fullText.includes(insight.toLowerCase()),
      fullText.includes(insight.toLowerCase()) ? '' : `Insight '${insight}' not found`,
    );
  }
}

// ─── 7. Report structure checks ───
const structureChecks = [
  { name: 'Has Pillar Scores section', pattern: /pillar scores/i },
  { name: 'Has Passing section', pattern: /## passing/i },
  { name: 'Has Failing section', pattern: /## failing/i },
  { name: 'Has progress bars', pattern: /[█░]/ },
];

for (const sc of structureChecks) {
  check(sc.name, sc.pattern.test(reportContent));
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

// ─── Simple YAML parser (for our known frontmatter structure) ───
function parseSimpleYaml(str) {
  const result = {};
  const lines = str.split('\n');
  let currentKey = null;
  let inNested = false;
  let nestedObj = {};

  for (const line of lines) {
    // Top-level key: value
    const topMatch = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
    if (topMatch) {
      if (inNested && currentKey) {
        result[currentKey] = nestedObj;
        nestedObj = {};
        inNested = false;
      }
      const [, key, value] = topMatch;
      result[key] = parseYamlValue(value);
      currentKey = key;
      continue;
    }

    // Top-level key with no inline value (start of nested)
    const blockStart = line.match(/^(\w[\w-]*)\s*:\s*$/);
    if (blockStart) {
      if (inNested && currentKey) {
        result[currentKey] = nestedObj;
        nestedObj = {};
      }
      currentKey = blockStart[1];
      inNested = true;
      continue;
    }

    // Nested key: { ... } or key: value
    if (inNested) {
      const nestedMatch = line.match(/^\s+([\w-]+)\s*:\s*(.+)$/);
      if (nestedMatch) {
        const [, nkey, nval] = nestedMatch;
        nestedObj[nkey] = parseYamlValue(nval);
      }
    }
  }

  if (inNested && currentKey) {
    result[currentKey] = nestedObj;
  }

  return result;
}

function parseYamlValue(str) {
  str = str.trim();
  // Handle { key: val, key: val } inline objects
  if (str.startsWith('{') && str.endsWith('}')) {
    const inner = str.slice(1, -1);
    const obj = {};
    const pairs = inner.split(',');
    for (const pair of pairs) {
      const [k, v] = pair.split(':').map((s) => s.trim());
      if (k && v !== undefined) obj[k] = parseYamlValue(v);
    }
    return obj;
  }
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  if (/^\d+\.\d+$/.test(str)) return parseFloat(str);
  // Strip quotes
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
}
