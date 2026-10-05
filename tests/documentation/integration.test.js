/** Standalone packaging and full-harness integration tests using synthetic projects. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const repo = path.resolve(__dirname, '../..');
const plugin = path.join(repo, 'plugins/documentation');

function temporary(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'documentation-integration-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  return root;
}
function run(script, args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], {cwd, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

test('marketplace offers documentation independently with matching manifest name', () => {
  const marketplace = JSON.parse(fs.readFileSync(path.join(repo, '.claude-plugin/marketplace.json')));
  const entry = marketplace.plugins.find(p => p.name === 'documentation');
  assert.ok(entry, 'separate documentation marketplace entry');
  assert.equal(entry.source, './plugins/documentation');
  const manifest = JSON.parse(fs.readFileSync(path.join(plugin, '.claude-plugin/plugin.json')));
  assert.equal(manifest.name, entry.name);
  assert.ok(fs.existsSync(path.join(plugin, 'skills/documentation/SKILL.md')));
});

test('extracted plugin and extracted skill each install without full harness', t => {
  for (const skillOnly of [false, true]) {
    const root = temporary(t);
    const source = skillOnly ? path.join(plugin, 'skills/documentation') : plugin;
    const extracted = path.join(root, 'extracted');
    assert.ok(fs.existsSync(source), 'distributable exists');
    fs.cpSync(source, extracted, {recursive: true});
    const scripts = skillOnly ? path.join(extracted, 'scripts') : path.join(extracted, 'skills/documentation/scripts');
    const target = path.join(root, 'project with spaces');
    fs.mkdirSync(path.join(target, 'src'), {recursive: true});
    fs.writeFileSync(path.join(target, 'src/example.py'), 'raise RuntimeError("must never import")\n');
    run(path.join(scripts, 'install.js'), [`--target=${target}`], root);
    fs.rmSync(extracted, {recursive: true});
    run(path.join(target, 'scripts/self-documentation/generate.js'), ['--check'], target);
    assert.match(fs.readFileSync(path.join(target, 'docs/index.md'), 'utf8'), /Documentation index/i);
    assert.equal(fs.existsSync(path.join(target, '.claude')), false);
    assert.equal(fs.existsSync(path.join(target, '.codex')), false);
    assert.equal(fs.existsSync(path.join(target, 'package.json')), false);
  }
});

test('full setup installs canonical engine and read-only staged check hook', t => {
  const target = temporary(t);
  fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({name: 'synthetic', version: '1.0.0'}));
  fs.writeFileSync(path.join(target, 'CLAUDE.md'), '# Existing project\n\nPreserve this authored text.\n');
  run(path.join(repo, 'skills/setup/scripts/install-enforcement.js'), [`--target=${target}`, '--skip-install'], target);
  const generate = path.join(target, 'scripts/self-documentation/generate.js');
  assert.ok(fs.existsSync(generate), 'canonical engine installed');
  assert.equal(fs.readFileSync(generate, 'utf8'), fs.readFileSync(path.join(plugin, 'skills/documentation/scripts/generate.js'), 'utf8'));
  const wrapper = fs.readFileSync(path.join(target, 'scripts/generate-docs.js'), 'utf8');
  assert.match(wrapper, /self-documentation/);
  assert.doesNotMatch(wrapper, /function buildDocsIndex/);
  const hook = fs.readFileSync(path.join(target, '.husky/pre-commit'), 'utf8');
  assert.match(hook, /self-documentation\/generate\.js --staged/);
  assert.doesNotMatch(hook, /^node scripts\/generate-docs\.js\s*$/m);
  run(path.join(target, 'scripts/generate-docs.js'), [], target);
  run(generate, ['--check'], target);
  assert.match(fs.readFileSync(path.join(target, 'CLAUDE.md'), 'utf8'), /Preserve this authored text/);
});

test('normal setup initializes Husky without replacing enforcement or custom hooks', t => {
  for (const custom of [false, true]) {
    const target = temporary(t);
    fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({name: 'synthetic', version: '1.0.0'}));
    if (custom) {
      fs.mkdirSync(path.join(target, '.husky'));
      fs.writeFileSync(path.join(target, '.husky/pre-commit'), '#!/bin/sh\necho custom\n');
    }
    const preload = path.join(target, 'stub-commands.cjs');
    fs.writeFileSync(preload, `
      const fs = require('node:fs'), path = require('node:path');
      require('node:child_process').execFileSync = (cmd, args, opts) => {
        fs.appendFileSync(path.join(opts.cwd, 'commands.jsonl'), JSON.stringify([cmd, ...args]) + '\\n');
        if (args.join(' ') === 'husky init') {
          fs.mkdirSync(path.join(opts.cwd, '.husky'), {recursive:true});
          fs.writeFileSync(path.join(opts.cwd, '.husky/pre-commit'), 'npm test\\n');
        }
        return Buffer.alloc(0);
      };
    `);
    const result = spawnSync(process.execPath, ['--require', preload,
      path.join(repo, 'skills/setup/scripts/install-enforcement.js'), `--target=${target}`], {cwd:target, encoding:'utf8'});
    assert.equal(result.status, 0, result.stderr);
    const hook = fs.readFileSync(path.join(target, '.husky/pre-commit'), 'utf8');
    if (custom) assert.equal(hook, '#!/bin/sh\necho custom\n');
    else assert.match(hook, /self-documentation\/generate\.js --staged/);
    const commands = fs.readFileSync(path.join(target, 'commands.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.ok(commands.some(cmd => cmd[1] === 'husky' && cmd.length === 2));
    assert.equal(commands.some(cmd => cmd[1] === 'husky' && cmd[2] === 'init'), false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(target, 'package.json'))).scripts.prepare, 'husky');
  }
});
