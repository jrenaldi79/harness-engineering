/**
 * Installs machine-level subagent model routing into ~/.claude.
 *
 * Usage:
 *   node install-agent-routing.js [--claude-dir=<path>]
 *
 * Actions (each skipped if already present, and existing choices are kept):
 *   1. Sets env.CLAUDE_CODE_SUBAGENT_MODEL=sonnet in settings.json
 *   2. Copies the Haiku Explore agent to agents/Explore.md
 *   3. Appends the routing guidance to CLAUDE.md
 *
 * This lives outside the plugin because plugin agents are namespaced, so they
 * cannot replace the built-in Explore, and enabling a plugin does not set env.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const TEMPLATES_DIR = path.resolve(__dirname, '../templates');
const MODEL_VAR = 'CLAUDE_CODE_SUBAGENT_MODEL';
const DEFAULT_MODEL = 'sonnet';
const GUIDANCE_HEADING = '## Subagent Model Routing';
const GUIDANCE_MARKER = '**Subagent model selection.**';

function parseClaudeDir(argv) {
  const flag = argv.slice(2).find(arg => arg.startsWith('--claude-dir='));
  return flag ? flag.slice('--claude-dir='.length) : path.join(os.homedir(), '.claude');
}

function readIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// Parsed before anything is written, so a broken file leaves the machine untouched.
function loadSettings(file) {
  const raw = readIfExists(file);
  if (raw === null) return {};
  const settings = JSON.parse(raw);
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!isObject(settings) || (settings.env !== undefined && !isObject(settings.env))) {
    throw new Error('expected an object with an object "env"');
  }
  return settings;
}

function installDefaultModel(file, settings) {
  const current = settings.env?.[MODEL_VAR];
  if (current === DEFAULT_MODEL) return `unchanged: ${MODEL_VAR} is ${DEFAULT_MODEL}`;
  if (current !== undefined) return `kept: ${MODEL_VAR} is already ${current}`;
  const updated = { ...settings, env: { ...settings.env, [MODEL_VAR]: DEFAULT_MODEL } };
  writeFile(file, `${JSON.stringify(updated, null, 2)}\n`);
  return `set: ${MODEL_VAR}=${DEFAULT_MODEL} in ${file}`;
}

function installExploreAgent(file) {
  const content = fs.readFileSync(path.join(TEMPLATES_DIR, 'agents/Explore.md'), 'utf8');
  const current = readIfExists(file);
  if (current === content) return `unchanged: ${file}`;
  if (current !== null) return `kept: ${file} differs from the template`;
  writeFile(file, content);
  return `created: ${file}`;
}

function installGuidance(file) {
  const current = readIfExists(file) ?? '';
  if (current.includes(GUIDANCE_MARKER)) return `unchanged: ${file} already has the guidance`;
  const guidance = fs.readFileSync(path.join(TEMPLATES_DIR, 'subagent-routing.md'), 'utf8');
  const section = `${GUIDANCE_HEADING}\n\n${guidance}`;
  const existing = current.trim() ? `${current.trimEnd()}\n\n` : '';
  writeFile(file, `${existing}${section}`);
  return `updated: ${file}`;
}

function main() {
  const claudeDir = parseClaudeDir(process.argv);
  const settingsFile = path.join(claudeDir, 'settings.json');

  let settings;
  try {
    settings = loadSettings(settingsFile);
  } catch (error) {
    console.error(`Error: cannot update ${settingsFile}: ${error.message}`);
    process.exit(1);
  }

  const results = [
    installDefaultModel(settingsFile, settings),
    installExploreAgent(path.join(claudeDir, 'agents/Explore.md')),
    installGuidance(path.join(claudeDir, 'CLAUDE.md')),
  ];
  results.forEach(result => console.log(result));
  console.log('Start a new Claude Code session for these changes to take effect.');
}

main();
