#!/usr/bin/env node
// Blocks commits if source files exceed 300 lines
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MAX_LINES = 300;
const SRC_DIR = path.join(process.cwd(), 'src');

function walkDir(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkDir(full));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) files.push(full);
  }
  return files;
}

let failed = false;
for (const file of walkDir(SRC_DIR)) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').length;
  if (lines > MAX_LINES) {
    console.error(`${file}: ${lines} lines (max ${MAX_LINES})`);
    failed = true;
  }
}

if (failed) process.exit(1);
