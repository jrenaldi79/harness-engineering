/**
 * Tests for skills/setup/scripts/install-agent-routing.js: the machine-level subagent
 * model routing installer. Each test runs against a temp directory standing in for ~/.claude.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const SETUP = path.resolve(__dirname, '../../skills/setup');
const SCRIPT = path.join(SETUP, 'scripts/install-agent-routing.js');
const TEMPLATES = path.join(SETUP, 'templates');

let claudeDir;

function install() {
  return spawnSync(process.execPath, [SCRIPT, `--claude-dir=${claudeDir}`], { encoding: 'utf8' });
}

function put(rel, content) {
  const file = path.join(claudeDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const read = rel => fs.readFileSync(path.join(claudeDir, rel), 'utf8');
const template = rel => fs.readFileSync(path.join(TEMPLATES, rel), 'utf8');
const settings = () => JSON.parse(read('settings.json'));

beforeEach(() => {
  claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-routing-'));
});

afterEach(() => {
  fs.rmSync(claudeDir, { recursive: true, force: true });
});

describe('fresh machine', () => {
  test('installs the default model, Explore agent and routing guidance', () => {
    const result = install();

    expect(result.status).toBe(0);
    expect(settings().env.CLAUDE_CODE_SUBAGENT_MODEL).toBe('sonnet');
    expect(read('agents/Explore.md')).toBe(template('agents/Explore.md'));
    expect(read('CLAUDE.md')).toContain(template('subagent-routing.md').trim());
  });

  test('does not force one model onto every subagent', () => {
    install();
    expect(settings().env).not.toHaveProperty('CLAUDE_CODE_SUBAGENT_MODEL_FORCE');
  });

  test('treats a whitespace-only CLAUDE.md as empty', () => {
    put('CLAUDE.md', '\n');
    install();
    expect(read('CLAUDE.md').startsWith('## Subagent Model Routing')).toBe(true);
  });
});

describe('existing configuration', () => {
  test('preserves other settings and env values', () => {
    put('settings.json', JSON.stringify({ env: { KEEP: '1' }, enabledPlugins: { a: true } }));
    install();

    expect(settings().env).toEqual({ KEEP: '1', CLAUDE_CODE_SUBAGENT_MODEL: 'sonnet' });
    expect(settings().enabledPlugins).toEqual({ a: true });
  });

  test('keeps a different default model and reports it', () => {
    put('settings.json', JSON.stringify({ env: { CLAUDE_CODE_SUBAGENT_MODEL: 'haiku' } }));
    const result = install();

    expect(result.status).toBe(0);
    expect(settings().env.CLAUDE_CODE_SUBAGENT_MODEL).toBe('haiku');
    expect(result.stdout).toMatch(/CLAUDE_CODE_SUBAGENT_MODEL.*haiku/);
  });

  test('keeps a customized Explore agent and reports it', () => {
    put('agents/Explore.md', 'custom\n');
    const result = install();

    expect(read('agents/Explore.md')).toBe('custom\n');
    expect(result.stdout).toMatch(/Explore\.md/);
  });

  test('appends to an existing CLAUDE.md without changing its content', () => {
    put('CLAUDE.md', '# Mine\n\nKeep this.\n');
    install();

    expect(read('CLAUDE.md').startsWith('# Mine\n\nKeep this.\n')).toBe(true);
    expect(read('CLAUDE.md')).toContain('## Subagent Model Routing');
  });

  test('skips CLAUDE.md when it already has the guidance under another heading', () => {
    const existing = `### 2. Subagent Strategy\n\n${template('subagent-routing.md')}`;
    put('CLAUDE.md', existing);
    install();

    expect(read('CLAUDE.md')).toBe(existing);
  });

  test('fails on invalid settings.json and writes nothing', () => {
    put('settings.json', '{ not json');
    const result = install();

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/settings\.json/);
    expect(read('settings.json')).toBe('{ not json');
    expect(fs.existsSync(path.join(claudeDir, 'agents/Explore.md'))).toBe(false);
    expect(fs.existsSync(path.join(claudeDir, 'CLAUDE.md'))).toBe(false);
  });

  test('fails when env is not an object and writes nothing', () => {
    put('settings.json', JSON.stringify({ env: 'nope' }));
    const result = install();

    expect(result.status).not.toBe(0);
    expect(read('settings.json')).toBe(JSON.stringify({ env: 'nope' }));
  });
});

describe('re-running', () => {
  test('changes nothing the second time', () => {
    install();
    const before = ['settings.json', 'agents/Explore.md', 'CLAUDE.md'].map(read);
    install();

    expect(['settings.json', 'agents/Explore.md', 'CLAUDE.md'].map(read)).toEqual(before);
  });
});

describe('templates', () => {
  test('Explore agent runs on Haiku and cannot write or spawn agents', () => {
    const frontmatter = template('agents/Explore.md').split(/^---$/m)[1];

    expect(frontmatter).toMatch(/^name: Explore$/m);
    expect(frontmatter).toMatch(/^model: haiku$/m);
    for (const tool of ['Agent', 'Edit', 'Write', 'NotebookEdit']) {
      expect(frontmatter).toMatch(new RegExp(`^disallowedTools:.*\\b${tool}\\b`, 'm'));
    }
  });

  test('Explore agent description is quoted so its colon stays valid YAML', () => {
    expect(template('agents/Explore.md')).toMatch(/^description: ".*"$/m);
  });

  test('routing guidance names the Haiku tier and the Fable advisor', () => {
    const guidance = template('subagent-routing.md');

    expect(guidance).toMatch(/`haiku`: research, exploration, search/);
    expect(guidance).toMatch(/`general-purpose` subagent with `model: fable`/);
  });

  test('global CLAUDE.md template carries the same routing guidance', () => {
    expect(template('global-claude.md')).toContain(template('subagent-routing.md').trim());
  });
});
