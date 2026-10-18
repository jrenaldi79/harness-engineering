'use strict';
// Regression tests for GitHub issue #33 (documentation engine adoption problems).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),childProcess=require('node:child_process');
const {execFileSync,spawnSync}=childProcess;
const scripts=path.resolve(__dirname,'../../plugins/documentation/skills/documentation/scripts');
const load=name=>require(path.join(scripts,name));
const read=(root,name)=>fs.readFileSync(path.join(root,name),'utf8');
const put=(root,name,value)=>{fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),value);};
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'issue33-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
function git(root,...args){return execFileSync('git',['-c','core.autocrlf=false','-c','user.name=T','-c','user.email=t@example.invalid',...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});}
const meta={title:'Guide',description:'Useful',type:'guidance',status:'maintained',read_when:'Editing'};
const front=(record=meta)=>'---\n'+Object.entries(record).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\nBody\n';

test('#1 installed scripts run inside an ESM package and install smoke-checks them',t=>{
 const root=fixture(t);put(root,'package.json','{"type":"module"}');
 load('install').install(root);
 assert.deepEqual(JSON.parse(read(root,'scripts/self-documentation/package.json')),{type:'commonjs'});
 const run=spawnSync(process.execPath,[path.join(root,'scripts/self-documentation/generate.js'),'--root='+root,'--check'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
});

test('#2 --staged reads blobs through a bounded number of git processes',t=>{
 const root=fixture(t);put(root,'documentation.config.json',JSON.stringify({version:1,sourceRoots:['src'],docsRoot:'docs',instruction:'CLAUDE.md',index:'docs/index.md',strict:false}));
 put(root,'CLAUDE.md','<!-- AUTO:docs -->\n\n<!-- /AUTO:docs -->\n');put(root,'src/a.js','x');
 for(let i=0;i<20;i++)put(root,`docs/d${i}.md`,front({...meta,title:'D'+i}));
 git(root,'init','--quiet');git(root,'add','.');
 const original=childProcess.spawnSync;let catFile=0;
 childProcess.spawnSync=(cmd,args,...rest)=>{if(cmd==='git'&&args.includes('cat-file'))catFile++;return original(cmd,args,...rest);};
 const keys=Object.keys(require.cache).filter(k=>k.startsWith(scripts));keys.forEach(k=>delete require.cache[k]);
 try{require(path.join(scripts,'generate')).generate(root);git(root,'add','.');catFile=0;require(path.join(scripts,'generate')).generate(root,{staged:true});}
 finally{childProcess.spawnSync=original;Object.keys(require.cache).filter(k=>k.startsWith(scripts)).forEach(k=>delete require.cache[k]);}
 assert.ok(catFile<=3,`expected at most 3 cat-file processes, saw ${catFile}`);
});

test('#3 --staged --write renders from the index and ignores untracked drafts',t=>{
 const root=fixture(t);const {generate}=load('generate');
 put(root,'documentation.config.json',JSON.stringify({version:1,sourceRoots:['src'],docsRoot:'docs',instruction:'CLAUDE.md',index:'docs/index.md',strict:false}));
 put(root,'CLAUDE.md','<!-- AUTO:docs -->\n\n<!-- /AUTO:docs -->\n');put(root,'src/a.js','x');
 generate(root);git(root,'init','--quiet');git(root,'add','.');git(root,'commit','--quiet','-m','base');
 put(root,'src/new.js','x');git(root,'add','src/new.js');put(root,'src/draft.js','untracked draft');
 assert.throws(()=>generate(root,{staged:true}),/Stale/);
 generate(root,{staged:true,write:true});
 assert.ok(!read(root,'docs/index.md').includes('draft.js'));assert.ok(read(root,'docs/index.md').includes('src/new.js'));
 git(root,'add','docs/index.md','CLAUDE.md');assert.doesNotThrow(()=>generate(root,{staged:true}));
 assert.notEqual(spawnSync(process.execPath,[path.join(scripts,'generate.js'),'--root='+root,'--write'],{encoding:'utf8'}).status,0);
});

test('#4 marker scanner ignores quoted markers in code spans and fences and reports lines',t=>{
 const {replaceMarkers}=load('render');const blocks={docs:'D',tree:'T',modules:'M'};
 const text='Use `<!-- AUTO:* -->` in a cell.\n\n```md\n<!-- AUTO:oops\n```\n\n<!-- AUTO:docs -->\nold\n<!-- /AUTO:docs -->\n';
 const out=replaceMarkers(text,blocks);assert.ok(out.startsWith('Use `<!-- AUTO:* -->` in a cell.'));assert.ok(out.includes('```md\n<!-- AUTO:oops\n```'));assert.ok(out.includes('\nD\n'));
 assert.throws(()=>replaceMarkers('a\nb\n<!-- AUTO:x -->\n<!-- AUTO:bad\n',blocks),/line 4/);
});

test('#6 --no-section appends only the marker pair and a one-line pointer',t=>{
 const root=fixture(t);put(root,'CLAUDE.md','Authored\n');
 load('install').install(root,{section:false});
 const text=read(root,'CLAUDE.md');assert.ok(text.includes('<!-- AUTO:docs -->'));assert.ok(!text.includes('Statuses:'));assert.ok(text.split('\n').length<=10,text);
 const other=fixture(t);put(other,'CLAUDE.md','Authored\n');
 assert.equal(spawnSync(process.execPath,[path.join(scripts,'install.js'),'--target='+other,'--no-section'],{encoding:'utf8'}).status,0);
 assert.ok(!read(other,'CLAUDE.md').includes('Statuses:'));
});

test('#7 upgrades tolerate added and removed scripts, config updates and excludes',t=>{
 const {install,FILES}=load('install');const root=fixture(t);install(root);
 const statePath='scripts/self-documentation/installed.json',state=JSON.parse(read(root,statePath));
 delete state.hashes[FILES[FILES.length-1]];fs.rmSync(path.join(root,'scripts/self-documentation',FILES[FILES.length-1]));
 const crypto=require('node:crypto');put(root,'scripts/self-documentation/old.js','retired');
 state.hashes['old.js']=crypto.createHash('sha256').update('retired').digest('hex');put(root,statePath,JSON.stringify(state));
 assert.doesNotThrow(()=>install(root));
 assert.ok(fs.existsSync(path.join(root,'scripts/self-documentation',FILES[FILES.length-1])));
 assert.ok(!fs.existsSync(path.join(root,'scripts/self-documentation/old.js')));
 assert.throws(()=>install(root,{docs:'notes'}),/configuration/);
 install(root,{docs:'notes',updateConfig:true});assert.equal(JSON.parse(read(root,'documentation.config.json')).docsRoot,'notes');
 const cfg=JSON.parse(read(root,'documentation.config.json'));cfg.exclude=['scripts/self-documentation'];put(root,'documentation.config.json',JSON.stringify(cfg));
 install(root);assert.ok(!read(root,'notes/index.md').includes('self-documentation'));
 const other=fixture(t);install(other,{exclude:'scripts/self-documentation'});assert.deepEqual(JSON.parse(read(other,'documentation.config.json')).exclude,['scripts/self-documentation']);
 assert.ok(!read(other,'docs/index.md').includes('self-documentation'));
});

test('#8 lenient mode reports malformed frontmatter as needing classification; default and strict still fail',t=>{
 const root=fixture(t);load('install').install(root);const {generate}=load('generate');
 put(root,'docs/ok.md',front());put(root,'docs/extra.md','---\n'+Object.entries({...meta,date:'2026-01-01'}).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\nBody\n');
 put(root,'docs/hr.md','---\n\nProse: with colon\n\n---\n');put(root,'docs/colon.md','---\ntitle: a: b\n---\n');
 assert.throws(()=>generate(root),/metadata|frontmatter/i);
 const result=generate(root,{lenient:true});const index=result.outputs['docs/index.md'];
 assert.ok(index.includes('Needs classification'));for(const name of ['extra.md','hr.md','colon.md'])assert.ok(index.includes(name),name);
 assert.ok(index.includes('Unknown metadata field date'));assert.equal(result.missing.length,3);
 assert.throws(()=>generate(root,{strict:true,lenient:true}),/Unknown metadata field|Malformed/);
});
