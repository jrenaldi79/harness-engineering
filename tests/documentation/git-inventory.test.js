'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const {execFileSync}=require('node:child_process');
const {generate,build,buildFromReader}=require('../../plugins/documentation/skills/documentation/scripts/generate');
const {working}=require('../../plugins/documentation/skills/documentation/scripts/filesystem');
const config={version:1,sourceRoots:['src'],docsRoot:'docs',instruction:'CLAUDE.md',index:'docs/index.md',strict:false};
const meta={title:'Guide',description:'Synthetic guide',type:'guidance',status:'maintained',read_when:'Changing code'};
const header=(record=meta)=>'---\n'+Object.entries(record).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\nBody\n';
function put(root,name,content){const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);}
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'git-inventory-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));put(root,'documentation.config.json',JSON.stringify(config));put(root,'CLAUDE.md','<!-- AUTO:docs -->\nold\n<!-- /AUTO:docs -->\n');put(root,'docs/guide.md',header());put(root,'src/a.js','Unread');return root;}
function git(root,...args){return execFileSync('git',['-c','core.autocrlf=false',...args],{cwd:root,encoding:'utf8'});}
function init(root){git(root,'init','--quiet');git(root,'add','.');}
test('working Git inventories honor ignored paths and retain tracked and new files',t=>{
  const root=fixture(t),baseline=generate(root);init(root);put(root,'.gitignore','src/ignored/\ndocs/local.log\n');git(root,'add','.gitignore');
  put(root,'src/ignored/runtime.log','Unread synthetic runtime');put(root,'docs/local.log','Unread synthetic log');
  assert.deepEqual(generate(root),baseline);assert.doesNotThrow(()=>generate(root,{staged:true}));
  put(root,'src/ignored/tracked.js','Unread');git(root,'add','-f','src/ignored/tracked.js');
  put(root,'src/new.js','Unread');put(root,'docs/new.md',header({...meta,title:'New'}));
  const output=generate(root).outputs['docs/index.md'];assert.ok(output.includes('src/ignored/tracked.js'));assert.ok(output.includes('src/new.js'));assert.ok(output.includes('[New]'));
  assert.ok(!output.includes('runtime.log'));assert.ok(!output.includes('local.log'));
  git(root,'add','src/new.js','docs/new.md','docs/index.md','CLAUDE.md');assert.doesNotThrow(()=>generate(root,{staged:true}));
});
test('working Git ignore filtering intentionally retains installer overlays',t=>{
  const root=fixture(t);init(root);put(root,'.gitignore','docs/virtual.md\nsrc/virtual.js\n');git(root,'add','.gitignore');
  const reader=working(root,{'docs/virtual.md':header({...meta,title:'Virtual'}),'src/virtual.js':'Unread'});
  const output=buildFromReader(reader).outputs['docs/index.md'];assert.ok(output.includes('[Virtual]'));assert.ok(output.includes('src/virtual.js'));
});
test('non-Git inventories need no Git binary and real repository errors fail explicitly',t=>{
  const root=fixture(t),taskPath=process.env.PATH;process.env.PATH='';
  try {assert.doesNotThrow(()=>build(root));} finally {process.env.PATH=taskPath;}
  fs.mkdirSync(path.join(root,'.git'));assert.throws(()=>build(root),/Git ignore.*failed/i);
});
test('ignored directories are pruned and tracked descendants retain link validation',t=>{
  const root=fixture(t);init(root);put(root,'.gitignore','src/ignored/\nsrc/link/\n');
  put(root,'src/ignored/runtime.log','Unread');put(root,'src/ignored/tracked.js','Unread');git(root,'add','-f','src/ignored/tracked.js');
  const original=fs.readdirSync;fs.readdirSync=function(file,...args){assert.notEqual(String(file),path.join(root,'src/ignored'));return original.call(this,file,...args);};
  try {assert.ok(build(root).outputs['docs/index.md'].includes('src/ignored/tracked.js'));} finally {fs.readdirSync=original;}
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'ignored-link-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  fs.symlinkSync(outside,path.join(root,'src/link'),'junction');assert.throws(()=>build(root),/link/i);
});
test('CRLF blank ignore lines do not hide unignored runtime directories',t=>{
  const root=fixture(t);generate(root);init(root);put(root,'.gitignore','# Synthetic ignore\r\n\r\n# End\r\n');
  put(root,'src/runtime/engine.js','Unread synthetic runtime');put(root,'docs/new.md',header({...meta,title:'New'}));
  const {spawnSync}=require('node:child_process');
  assert.equal(spawnSync('git',['check-ignore','--no-index','src/runtime/engine.js'],{cwd:root}).status,1);
  assert.equal(spawnSync('git',['check-ignore','--no-index','src/runtime'],{cwd:root}).status,1);
  const output=generate(root).outputs['docs/index.md'];assert.ok(output.includes('src/runtime/engine.js'));assert.ok(output.includes('[New]'));
  git(root,'add','src/runtime/engine.js','docs/new.md','docs/index.md','CLAUDE.md');assert.doesNotThrow(()=>generate(root,{staged:true}));
});
