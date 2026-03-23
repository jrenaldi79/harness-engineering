#!/usr/bin/env node
// Scans staged files for hardcoded secrets
const { execSync } = require('child_process');

const SECRET_PATTERNS = [
  /sk-ant-api\w+/,
  /sk-or-v1-\w+/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /-----BEGIN.*PRIVATE KEY-----/,
];

const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

let found = false;
for (const file of staged) {
  try {
    const content = require('fs').readFileSync(file, 'utf8');
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        console.error(`SECRET DETECTED in ${file}: matches ${pattern}`);
        found = true;
      }
    }
  } catch {}
}

if (found) {
  process.exit(1);
}
