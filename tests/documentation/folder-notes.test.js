'use strict';
// Opt-in folder notes: every folder that directly holds source files carries an
// instruction-named note (CLAUDE.md or AGENTS.md) whose frontmatter description
// heads that folder in the generated source inventory.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const scripts = path.resolve(__dirname, '../../plugins/documentation/skills/documentation/scripts');
const {generate, validateConfig, defaults} = require(path.join(scripts, 'generate'));
const {install} = require(path.join(scripts, 'install'));
const base = {version:1, sourceRoots:['src','scripts'], docsRoot:'docs', instruction:'CLAUDE.md', index:'docs/index.md', strict:false};
const note = (title, description) => `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\ntype: "guidance"\nstatus: "maintained"\nread_when: "Changing ${title}."\n---\n\nBody\n`;
function put(root, name, content) { const file=path.join(root,name); fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,content); }
function fixture(t, config = {...base, folderNotes:true}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'folder-notes-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  put(root,'documentation.config.json',JSON.stringify(config));
  put(root,'CLAUDE.md','<!-- AUTO:docs -->\n<!-- /AUTO:docs -->\n');
  put(root,'src/main.ts','x'); put(root,'src/llm/client.ts','x'); put(root,'src/llm/wire/format.ts','x');
  put(root,'scripts/check.ts','x'); put(root,'scripts/self-documentation/generate.js','x');
  return root;
}
const withNotes = root => {
  put(root,'src/llm/CLAUDE.md',note('src/llm','OpenRouter client | caching'));
  put(root,'src/llm/wire/CLAUDE.md',note('src/llm/wire','Wire format for chat requests'));
};

test('disabled by default: no notes required and the inventory stays flat', t => {
  const {folderNotes, ...config} = {...base, folderNotes:false};
  const root=fixture(t,config);
  const index=generate(root).outputs['docs/index.md'];
  assert.ok(!index.includes('### '));
  assert.ok(index.includes('- [src/llm/client.ts](../src/llm/client.ts)'));
  assert.equal(folderNotes,false);
});

test('folderNotes must be a boolean', () => {
  assert.throws(()=>validateConfig({...base, folderNotes:'yes'}),/folderNotes/);
  assert.equal(validateConfig({...base, folderNotes:true}).folderNotes,true);
  assert.ok(!Object.hasOwn(defaults,'folderNotes'));
});

test('enabled: every nested code folder needs its own note; roots and the engine folder are exempt', t => {
  const root=fixture(t);
  assert.throws(()=>generate(root),err=>{
    assert.match(err.message,/Missing folder notes: src\/llm\/CLAUDE\.md, src\/llm\/wire\/CLAUDE\.md$/);
    return true;
  });
  put(root,'src/llm/CLAUDE.md',note('src/llm','LLM'));
  assert.throws(()=>generate(root,{check:true}),/Missing folder notes: src\/llm\/wire\/CLAUDE\.md$/);
});

test('enabled: the inventory is grouped by folder under each note description', t => {
  const root=fixture(t); withNotes(root);
  const index=generate(root).outputs['docs/index.md'];
  assert.ok(index.includes('\n### src\n\n- [src/main.ts](../src/main.ts)\n'));
  assert.ok(index.includes('\n### [src/llm](../src/llm/CLAUDE.md): OpenRouter client &#124; caching\n\n- [src/llm/client.ts](../src/llm/client.ts)\n'));
  assert.ok(index.includes('\n### [src/llm/wire](../src/llm/wire/CLAUDE.md): Wire format for chat requests\n\n- [src/llm/wire/format.ts](../src/llm/wire/format.ts)\n'));
  assert.ok(!index.includes('- [src/llm/CLAUDE.md]'), 'the note heads its group instead of being listed');
  assert.ok(index.indexOf('### src\n')<index.indexOf('### [src/llm]') && index.indexOf('### [src/llm]')<index.indexOf('### [src/llm/wire]'));
  assert.doesNotThrow(()=>generate(root,{check:true}));
});

test('a note without valid frontmatter fails with its path', t => {
  const root=fixture(t); withNotes(root); put(root,'src/llm/CLAUDE.md','# Just prose\n');
  assert.throws(()=>generate(root),/Folder note needs metadata: src\/llm\/CLAUDE\.md/);
});

test('AGENTS.md projects use AGENTS.md notes', t => {
  const root=fixture(t,{...base, instruction:'AGENTS.md', folderNotes:true});
  put(root,'AGENTS.md','<!-- AUTO:docs -->\n<!-- /AUTO:docs -->\n');
  assert.throws(()=>generate(root),/src\/llm\/AGENTS\.md/);
});

test('excluded folders need no note', t => {
  const root=fixture(t,{...base, folderNotes:true, exclude:['src/llm']});
  assert.doesNotThrow(()=>generate(root));
});

test('staged checks read notes from the index', t => {
  const root=fixture(t); withNotes(root); generate(root);
  execFileSync('git',['init','--quiet'],{cwd:root}); execFileSync('git',['add','.'],{cwd:root});
  assert.doesNotThrow(()=>generate(root,{staged:true}));
  fs.rmSync(path.join(root,'src/llm/wire/CLAUDE.md'));
  assert.doesNotThrow(()=>generate(root,{staged:true}), 'unstaged deletion does not affect the staged snapshot');
  execFileSync('git',['add','-A'],{cwd:root});
  assert.throws(()=>generate(root,{staged:true}),/Missing folder notes: src\/llm\/wire\/CLAUDE\.md/);
});

test('installer writes folderNotes into a new config', t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'folder-notes-install-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  put(root,'src/main.ts','x');
  install(root,{folderNotes:true});
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'documentation.config.json'),'utf8')).folderNotes,true);
});

test('installer CLI accepts --folder-notes', t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'folder-notes-cli-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  put(root,'src/main.ts','x');
  execFileSync(process.execPath,[path.join(scripts,'install.js'),'--target='+root,'--folder-notes'],{stdio:'pipe'});
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'documentation.config.json'),'utf8')).folderNotes,true);
});
