'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync,spawnSync}=require('node:child_process');
const scripts=path.resolve(__dirname,'../../plugins/documentation/skills/documentation/scripts');
const get=()=>require(path.join(scripts,'install'));
const read=(root,name)=>fs.readFileSync(path.join(root,name),'utf8');
const put=(root,name,value)=>{fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),value);};
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'documentation install quote ü '));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
function git(root,...args){return execFileSync('git',['-c','core.autocrlf=false',...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});}
const meta={title:'Guide',description:'Useful',type:'guidance',status:'maintained',read_when:'Editing'};
test('standalone install owns seven scripts, preserves authored instruction and repeats',t=>{
 const source=fixture(t),root=fixture(t);fs.cpSync(scripts,path.join(source,'scripts'),{recursive:true});
 put(root,'CLAUDE.md','Authored\r\n');put(root,'src/a.js','payload');
 const install=require(path.join(source,'scripts/install')).install;
 const first=install(root);assert.equal(first.version,'0.1.0');assert.equal(Object.keys(first.hashes).length,7);
 const instruction=read(root,'CLAUDE.md');assert.ok(instruction.startsWith('Authored\r\n'));
 for(const text of ['title:','description:','type:','status:','read_when:','one-line strings','guidance/status/reference/proposal/generated/history/temporary','maintained/snapshot/pending/completed/abandoned/superseded/temporary/generated','authored prose in the same change'])assert.ok(instruction.includes(text),text);
 const index=read(root,'docs/index.md');assert.match(index,/self-documentation\/install.js/);
 install(root);assert.equal(read(root,'CLAUDE.md'),instruction);
 for(const name of ['.claude','.codex','package.json'])assert.ok(!fs.existsSync(path.join(root,name)));
 assert.equal(spawnSync(process.execPath,[path.join(root,'scripts/self-documentation/generate.js'),'--root='+root,'--check']).status,0);
});
test('modified ownership, invalid state and conflicting options fail before writes',t=>{
 const root=fixture(t);get().install(root);const config=read(root,'documentation.config.json');
 assert.throws(()=>get().install(root,{docs:'notes'}),/configuration/);
 put(root,'scripts/self-documentation/render.js','local edit');
 assert.throws(()=>get().install(root),/modified/);assert.equal(read(root,'documentation.config.json'),config);
 put(root,'scripts/self-documentation/installed.json','{"version":"0.1.0","hashes":{}}');
 assert.throws(()=>get().install(root),/state/);
});
test('CRLF hashes survive and unmodified version upgrades are reported',t=>{
 const root=fixture(t);get().install(root);
 for(const name of get().FILES)put(root,'scripts/self-documentation/'+name,read(root,'scripts/self-documentation/'+name).replace(/\r?\n/g,'\r\n'));
 const state=JSON.parse(read(root,'scripts/self-documentation/installed.json'));state.version='0.0.9';put(root,'scripts/self-documentation/installed.json',JSON.stringify(state));
 const result=get().install(root);assert.equal(result.previousVersion,'0.0.9');assert.equal(result.version,'0.1.0');
});
test('handwritten index needs adoption and malformed markers refuse all writes',t=>{
 const root=fixture(t);put(root,'docs/index.md','Handwritten');
 assert.throws(()=>get().install(root),/adopt/);assert.ok(!fs.existsSync(path.join(root,'documentation.config.json')));
 get().install(root,{adoptIndex:true});assert.match(read(root,'docs/index.md'),/^<!-- Generated/);
 const other=fixture(t);put(other,'CLAUDE.md','<!-- AUTO:docs -->\nunterminated');
 assert.throws(()=>get().install(other),/marker/i);assert.ok(!fs.existsSync(path.join(other,'documentation.config.json')));
});
test('Phase4 defers absent instruction/index and appends existing instruction',t=>{
 const root=fixture(t);get().install(root,{createInstruction:false,refresh:false});
 assert.ok(!fs.existsSync(path.join(root,'CLAUDE.md')));assert.ok(!fs.existsSync(path.join(root,'docs/index.md')));
 const other=fixture(t);put(other,'AGENTS.md','Original');get().install(other,{instruction:'AGENTS.md',createInstruction:false,refresh:false});
 assert.ok(read(other,'AGENTS.md').startsWith('Original'));assert.match(read(other,'AGENTS.md'),/AUTO:docs/);
});
test('linked root and linked output parent refuse without following them',t=>{
 const root=fixture(t),other=fixture(t),link=path.join(root,'linked');fs.symlinkSync(other,link,'junction');
 assert.throws(()=>get().install(link),/link/i);fs.symlinkSync(other,path.join(root,'scripts'),'junction');
 assert.throws(()=>get().install(root),/link/i);assert.equal(fs.readdirSync(other).length,0);
});
test('CLI requires target and rejects empty or unknown arguments',()=>{
 const cli=path.join(scripts,'install.js');for(const args of [[],['--target='],['--target=x','--sources='],['--wat']])assert.notEqual(spawnSync(process.execPath,[cli,...args]).status,0);
});
test('migration previews names then preserves body bytes and keeps attachment/absent records',t=>{
 const root=fixture(t);get().install(root);const migrate=require(path.join(scripts,'migrate')).migrate;
 put(root,'docs/guide.md','Body\r\nSecond\r\n');put(root,'docs/image.pdf',Buffer.from([255,0]));
 put(root,'docs/catalog.json',JSON.stringify({'guide.md':meta,'image.pdf':meta,'absent.md':meta}));
 const preview=migrate(root);assert.deepEqual(preview.changes,['docs/guide.md']);assert.equal(read(root,'docs/guide.md'),'Body\r\nSecond\r\n');
 migrate(root,{write:true});assert.ok(read(root,'docs/guide.md').endsWith('---\r\nBody\r\nSecond\r\n'));
 assert.deepEqual(Object.keys(JSON.parse(read(root,'docs/catalog.json'))),['image.pdf','absent.md']);
 assert.deepEqual(migrate(root).changes,[]);
});
test('migration conflict and oversized document fail without partial changes',t=>{
 const root=fixture(t);get().install(root);const migrate=require(path.join(scripts,'migrate')).migrate;
 put(root,'docs/a.md','Body');put(root,'docs/z.md','---\n'+Object.entries({...meta,title:'Other'}).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\nBody');
 put(root,'docs/catalog.json',JSON.stringify({'a.md':meta,'z.md':meta}));const before=read(root,'docs/catalog.json');
 assert.throws(()=>migrate(root,{write:true}),/Conflicting/);assert.equal(read(root,'docs/a.md'),'Body');assert.equal(read(root,'docs/catalog.json'),before);
 put(root,'docs/z.md','x'.repeat(1048577));assert.throws(()=>migrate(root,{write:true}),/Bounded/);
});
test('hook runs staged check on real commits in quoted project path without autostaging',t=>{
 const parent=fixture(t),root=path.join(parent,"project 'quoted'");fs.mkdirSync(root);git(root,'init','--quiet');
 get().install(root,{hook:true});git(root,'add','.');
 git(root,'-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','commit','--quiet','-m','initial');
 put(root,'src/new.js','synthetic');git(root,'add','src/new.js');
 assert.throws(()=>git(root,'-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','commit','--quiet','-m','stale'),/Stale/);
 require(path.join(scripts,'generate')).generate(root);assert.match(git(root,'diff','--cached','--name-only'),/^src\/new.js/m);
 git(root,'add','CLAUDE.md','docs/index.md');git(root,'-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','commit','--quiet','-m','fresh');
});
test('hook preserves existing hooks and core.hooksPath and rejects links/shared worktree',t=>{
 const root=fixture(t);git(root,'init','--quiet');const hook=require(path.join(scripts,'install-hook'));
 put(root,'.git/hooks/pre-commit','#!/bin/sh\nexit 0\n');const before=read(root,'.git/hooks/pre-commit');
 assert.equal(hook.installHook(root).installed,false);assert.equal(read(root,'.git/hooks/pre-commit'),before);
 git(root,'config','core.hooksPath','custom-hooks');assert.equal(hook.installHook(root).installed,false);assert.equal(git(root,'config','--get','core.hooksPath').trim(),'custom-hooks');
 git(root,'config','--unset','core.hooksPath');fs.unlinkSync(path.join(root,'.git/hooks/pre-commit'));
 const other=fixture(t);fs.symlinkSync(other,path.join(root,'.git/hooks/pre-commit'),'junction');assert.throws(()=>hook.installHook(root),/link/i);
 const linked=fixture(t);put(linked,'.git','gitdir: '+path.join(root,'.git'));assert.throws(()=>hook.installHook(linked),/default|outside|worktree/i);
});
test('legacy index grammar adopts generated inventory and rejects added prose',t=>{
 const root=fixture(t);put(root,'docs/guide.md','Body');put(root,'docs/index.md','# Documentation Index\n\n- [guide.md](docs/guide.md) — Guide\n');
 get().install(root);assert.match(read(root,'docs/index.md'),/^<!-- Generated/);
 const other=fixture(t);put(other,'docs/guide.md','Body');put(other,'docs/index.md','# Documentation Index\n\nAuthored introduction\n- [guide.md](docs/guide.md)\n');
 assert.throws(()=>get().install(other),/adopt/);assert.ok(!fs.existsSync(path.join(other,'documentation.config.json')));
});
test('unowned conflicting script and malformed metadata reject before installing',t=>{
 const root=fixture(t);put(root,'scripts/self-documentation/generate.js','owned elsewhere');assert.throws(()=>get().install(root),/Unowned/);
 assert.ok(!fs.existsSync(path.join(root,'documentation.config.json')));
 const other=fixture(t);put(other,'docs/bad.md','---\nunknown: value\n---\n');assert.throws(()=>get().install(other),/metadata/);
 assert.ok(!fs.existsSync(path.join(other,'scripts')));
});
test('existing custom config and marker blocks preserve all surrounding bytes',t=>{
 const root=fixture(t);const config={version:1,sourceRoots:['source'],docsRoot:'manual',instruction:'AGENTS.md',index:'manual/custom.md',strict:false};
 put(root,'documentation.config.json',JSON.stringify(config));
 const authored='Start\r\n<!-- AUTO:tree -->\r\nold\r\n<!-- /AUTO:tree -->\r\nTail';put(root,'AGENTS.md',authored);
 get().install(root);assert.equal(read(root,'documentation.config.json'),JSON.stringify(config));assert.match(read(root,'manual/custom.md'),/^<!-- Generated/);
 assert.ok(read(root,'AGENTS.md').startsWith('Start\r\n'));assert.ok(read(root,'AGENTS.md').includes('\r\nTail\r\n'));
 assert.throws(()=>get().install(root,{sources:['src']}),/configuration/);
});
test('optional hook errors preflight before installation changes',t=>{
 const root=fixture(t);assert.throws(()=>get().install(root,{hook:true}),/Git repository/);
 assert.equal(fs.readdirSync(root).length,0);
 git(root,'init','--quiet');const outside=fixture(t);fs.rmSync(path.join(root,'.git/hooks'),{recursive:true});fs.symlinkSync(outside,path.join(root,'.git/hooks'),'junction');
 assert.throws(()=>get().install(root,{hook:true}),/link/i);assert.ok(!fs.existsSync(path.join(root,'documentation.config.json')));assert.equal(fs.readdirSync(outside).length,0);
});
test('migration matching frontmatter stays byte-identical and removes only its record',t=>{
 const root=fixture(t);get().install(root);const text='\uFEFF---\r\n'+Object.entries(meta).map(([k,v])=>k+': '+JSON.stringify(v)).join('\r\n')+'\r\n---\r\nBody without final newline';
 put(root,'docs/match.md',text);put(root,'docs/catalog.json',JSON.stringify({'match.md':meta}));
 require(path.join(scripts,'migrate')).migrate(root,{write:true});assert.equal(read(root,'docs/match.md'),text);assert.deepEqual(JSON.parse(read(root,'docs/catalog.json')),{});
});
test('migration CLI preview lists bounded names and unknown args fail',t=>{
 const root=fixture(t);get().install(root);put(root,'docs/a.md','Body');put(root,'docs/catalog.json',JSON.stringify({'a.md':meta}));
 const result=spawnSync(process.execPath,[path.join(scripts,'migrate.js'),'--root='+root],{encoding:'utf8'});assert.equal(result.status,0);assert.match(result.stdout,/preview: 1 documents/);assert.match(result.stdout,/docs\/a.md/);assert.equal(read(root,'docs/a.md'),'Body');
 for(const name of ['migrate.js','install-hook.js'])for(const arg of ['--root=','--unknown'])assert.notEqual(spawnSync(process.execPath,[path.join(scripts,name),arg]).status,0);
});
test('migration preserves untouched legacy attachment and missing-document catalog records',t=>{
 const root=fixture(t);get().install(root);const legacy={title:'Old',note:'Historical',type:'history',status:'snapshot'};
 put(root,'docs/a.md','Body');put(root,'docs/image.pdf',Buffer.from([255,0]));
 put(root,'docs/catalog.json',JSON.stringify({'a.md':meta,'image.pdf':legacy,'missing.md':legacy}));
 require(path.join(scripts,'migrate')).migrate(root,{write:true});
 assert.deepEqual(JSON.parse(read(root,'docs/catalog.json')),{'image.pdf':legacy,'missing.md':legacy});
});
test('deferred install promotes an existing legacy index for the later generator',t=>{
 const root=fixture(t);put(root,'docs/guide.md','Body');put(root,'docs/index.md','# Documentation Index\n\n- [guide.md](docs/guide.md) — Guide\n');
 get().install(root,{createInstruction:false,refresh:false});assert.match(read(root,'docs/index.md'),/^<!-- Generated/);
 assert.ok(!fs.existsSync(path.join(root,'CLAUDE.md')));
 put(root,'CLAUDE.md','Authored\n<!-- AUTO:docs -->\n\n<!-- /AUTO:docs -->\n');require(path.join(scripts,'generate')).generate(root);
 const adopted=fixture(t);put(adopted,'docs/index.md','Explicitly adopted');get().install(adopted,{createInstruction:false,refresh:false,adoptIndex:true});assert.match(read(adopted,'docs/index.md'),/^<!-- Generated/);
});
test('hook refuses a Git common directory outside the target repository',t=>{
 const root=fixture(t),shared=fixture(t);git(root,'init','--quiet');git(shared,'init','--quiet');
 put(root,'.git/commondir',path.join(shared,'.git')+'\n');
 assert.throws(()=>require(path.join(scripts,'install-hook')).planHook(root),/outside|default|shared/);
 assert.ok(!fs.existsSync(path.join(shared,'.git/hooks/pre-commit')));
});
test('reinstall restores exact owned hook permissions without changing bytes or planning writes',t=>{
 const root=fixture(t);git(root,'init','--quiet');const hook=require(path.join(scripts,'install-hook'));
 const created=hook.installHook(root),file=created.file,bytes=fs.readFileSync(file);
 fs.chmodSync(file,process.platform==='win32'?0o444:0o644);
 const originalMode=fs.statSync(file).mode&0o777,plan=hook.planHook(root);
 assert.equal(plan.existing,true);assert.equal(fs.statSync(file).mode&0o777,originalMode);assert.deepEqual(fs.readFileSync(file),bytes);
 const result=hook.installHook(root);assert.equal(result.installed,true);assert.deepEqual(fs.readFileSync(file),bytes);
 if(process.platform==='win32')assert.ok(fs.statSync(file).mode&0o200,'owned hook becomes writable on Windows');
 else assert.equal(fs.statSync(file).mode&0o777,0o755,'owned hook becomes executable on POSIX');
 const custom=fixture(t);git(custom,'init','--quiet');put(custom,'.git/hooks/pre-commit','#!/bin/sh\n# custom\nexit 0\n');
 const customFile=path.join(custom,'.git/hooks/pre-commit');fs.chmodSync(customFile,process.platform==='win32'?0o444:0o644);
 const customMode=fs.statSync(customFile).mode;assert.equal(hook.installHook(custom).installed,false);assert.equal(fs.statSync(customFile).mode,customMode);
});
test('hook compares real directory identity across Windows root casing',t=>{
 const root=fixture(t);git(root,'init','--quiet');const hook=require(path.join(scripts,'install-hook'));
 fs.rmSync(path.join(root,'.git/hooks'),{recursive:true});
 const input=process.platform==='win32'?root.toUpperCase():root;
 const plan=hook.planHook(input);assert.equal(plan.installed,true);assert.ok(!fs.existsSync(path.join(root,'.git/hooks/pre-commit')));
 hook.installHook(input);assert.match(read(root,'.git/hooks/pre-commit'),/generate\.js --staged/);
 const nested=path.join(root,'child');fs.mkdirSync(nested);assert.throws(()=>hook.planHook(nested),/Git repository|project root/);
});
