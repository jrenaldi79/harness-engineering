'use strict';
// The ownership statement ships in every installed CLAUDE.md or AGENTS.md. It lives in the
// managed AUTO:docs region, so a refresh restores it and `--check`/`--staged` fail without it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const scripts = path.resolve(__dirname, '../../plugins/documentation/skills/documentation/scripts');
const {generate} = require(path.join(scripts, 'generate'));
const {install} = require(path.join(scripts, 'install'));
const {OWNERSHIP_LINE} = require(path.join(scripts, 'render'));

const LINE = "This codebase is yours: what it's for and how it's built are your call, and you'll keep building on it.";
const region = text => /<!-- AUTO:docs -->\r?\n([\s\S]*?)<!-- \/AUTO:docs -->/.exec(text)[1];
const read = (root, name) => fs.readFileSync(path.join(root, name), 'utf8');
function put(root, name, content) { const file=path.join(root,name); fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,content); }
function fixture(t, instruction, text) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'documentation-ownership-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  put(root,'documentation.config.json',JSON.stringify({version:1,sourceRoots:['src'],docsRoot:'docs',instruction,index:'docs/index.md',strict:false}));
  if (text !== undefined) put(root,instruction,text);
  put(root,'src/a.js','x');
  return root;
}

test('render exports the exact ownership statement', () => {
  assert.equal(OWNERSHIP_LINE, LINE);
});

for (const instruction of ['CLAUDE.md', 'AGENTS.md']) {
  test(`generated ${instruction} carries the ownership statement in the docs region`, t => {
    const root=fixture(t,instruction,'# P\n<!-- AUTO:docs -->\n<!-- /AUTO:docs -->\n');
    assert.ok(region(generate(root).outputs[instruction]).includes(LINE));
  });

  test(`fresh install writes the ownership statement into ${instruction}`, t => {
    const root=fixture(t,instruction);
    fs.rmSync(path.join(root,'documentation.config.json'));
    install(root,{instruction});
    assert.ok(region(read(root,instruction)).includes(LINE));
  });
}

test('removing the ownership statement fails the check and a refresh restores it', t => {
  const root=fixture(t,'CLAUDE.md','# P\n<!-- AUTO:docs -->\n<!-- /AUTO:docs -->\n');
  generate(root);
  const current=read(root,'CLAUDE.md');
  put(root,'CLAUDE.md',current.replace(LINE+'\n',''));
  assert.throws(()=>generate(root,{check:true}),/Stale generated documentation: .*CLAUDE\.md/);
  generate(root);
  assert.equal(read(root,'CLAUDE.md'),current);
  assert.doesNotThrow(()=>generate(root,{check:true}));
});

test('setup project CLAUDE.md template already contains the ownership statement', () => {
  const template=fs.readFileSync(path.resolve(__dirname,'../../skills/setup/templates/project-claude.md'),'utf8');
  assert.ok(region(template).includes(LINE));
});

test('this repository CLAUDE.md carries the ownership statement', () => {
  assert.ok(region(fs.readFileSync(path.resolve(__dirname,'../../CLAUDE.md'),'utf8')).includes(LINE));
});
