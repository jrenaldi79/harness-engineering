#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {working}=require('./filesystem');
const {parseJSON,types,statuses}=require('./metadata');
const {defaults,validateConfig,build}=require('./generate');
const {INDEX_MARKER}=require('./render');
const {planHook,applyHook}=require('./install-hook');
const VERSION='0.1.0';
const FILES=['filesystem.js','metadata.js','render.js','generate.js','install.js','migrate.js','install-hook.js'];
const DEST='scripts/self-documentation',STATE=DEST+'/installed.json';
const json=value=>JSON.stringify(value,null,2)+'\n';
const hash=text=>crypto.createHash('sha256').update(text.replace(/\r\n/g,'\n'),'utf8').digest('hex');
function nodeVersion(){if(Number(process.versions.node.split('.')[0])<18)throw new Error('Documentation tooling requires Node.js 18+');}
function stateFrom(text){
 const value=parseJSON(text,'installation state');
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='hashes,version'||typeof value.version!=='string'||!/^\d+\.\d+\.\d+$/.test(value.version)||!value.hashes||typeof value.hashes!=='object'||Array.isArray(value.hashes))throw new Error('Invalid installation state');
 if(Object.keys(value.hashes).sort().join(',')!==[...FILES].sort().join(',')||Object.values(value.hashes).some(x=>typeof x!=='string'||! /^[a-f0-9]{64}$/.test(x)))throw new Error('Invalid installation state hashes');
 return value;
}
function instructionSection(text){
 const newline=text.includes('\r\n')?'\r\n':'\n';
 if(/<!--\s*\/?\s*AUTO\s*:\s*docs\b/.test(text))return text;
 const section=['## Documentation maintenance','','Classify Markdown with flat frontmatter at the start of the document. All five fields are required one-line strings; use JSON-quoted values. Example:','','```yaml','---','title: "Guide"','description: "Purpose of this document"','type: "guidance"','status: "maintained"','read_when: "When making related changes"','---','```','',
  'Types: '+types.join('/')+'.','Statuses: '+statuses.join('/')+'.',
  'Catalog `'+defaults.docsRoot+'/catalog.json` records use the same fields for attachments or Markdown without frontmatter. Use the configured docs root when different.',
  'Update authored prose in the same change as related behavior. Refresh after source or documentation changes, and check before committing.','',
  'Run `node scripts/self-documentation/generate.js` to refresh and add `--check` to validate.','','<!-- AUTO:docs -->','','<!-- /AUTO:docs -->',''].join(newline);
 return text+(text.endsWith('\n')?'':newline)+newline+section;
}
// Only the exact legacy generator grammar is eligible; arbitrary prose needs adoption.
function legacyIndex(text,config,reader){
 if(config.docsRoot!=='docs'||config.index!=='docs/index.md')return false;
 const lines=text.replace(/\r\n/g,'\n').split('\n');if(lines.shift()!=='# Documentation Index'||lines.shift()!=='')return false;
 let group='',entries=0;const found=new Set(reader.files('docs'));
 for(const line of lines){if(!line)continue;const heading=/^## ([^\[\]#]+)$/.exec(line);if(heading){group=heading[1];continue;}
  const item=/^- \[([^\[\]]+\.md)\]\((docs\/[^()]+\.md)\)(?: — [^\r\n]+)?$/.exec(line);
  if(!item||item[2]!==`docs/${group?group+'/':''}${item[1]}`||!found.has(item[2])||item[2]===config.index)return false;entries++;
 }
 return entries>0;
}
function install(target,options={}){
 nodeVersion();if(typeof target!=='string'||!target)throw new Error('A target directory is required');
 const reader=working(target),overlay={},hashes={};
 for(const key of Object.keys(options))if(!['instruction','sources','sourceRoots','docs','docsRoot','adoptIndex','hook','createInstruction','refresh'].includes(key))throw new Error(`Unknown install option: ${key}`);
 for(const key of ['adoptIndex','hook','createInstruction','refresh'])if(Object.hasOwn(options,key)&&typeof options[key]!=='boolean')throw new Error(`Invalid install option: ${key}`);
 const stateText=reader.read(STATE,65536),state=stateText===null?null:stateFrom(stateText);
 for(const name of FILES){
  const destination=DEST+'/'+name,existing=reader.read(destination,1048576);
  if(state&&(existing===null||hash(existing)!==state.hashes[name]))throw new Error(`Locally modified or missing owned script: ${destination}`);
  if(!state&&existing!==null)throw new Error(`Unowned conflicting script: ${destination}`);
  const source=fs.readFileSync(path.join(__dirname,name),'utf8');if(Buffer.byteLength(source)>1048576)throw new Error(`Script exceeds size limit: ${name}`);
  overlay[destination]=source;hashes[name]=hash(source);
 }
 const supplied={};
 if(Object.hasOwn(options,'instruction'))supplied.instruction=options.instruction;
 if(Object.hasOwn(options,'sources')||Object.hasOwn(options,'sourceRoots'))supplied.sourceRoots=options.sourceRoots??options.sources;
 if(typeof supplied.sourceRoots==='string')supplied.sourceRoots=supplied.sourceRoots.split(',');
 if(Object.hasOwn(options,'docs')||Object.hasOwn(options,'docsRoot')){supplied.docsRoot=options.docsRoot??options.docs;supplied.index=supplied.docsRoot+'/index.md';}
 const configText=reader.read('documentation.config.json',65536);
 const config=configText===null?validateConfig({...defaults,...supplied}):validateConfig(parseJSON(configText,'config'));
 if(configText!==null)for(const [key,value]of Object.entries(supplied))if(JSON.stringify(config[key])!==JSON.stringify(value))throw new Error(`Existing configuration differs: ${key}`);
 overlay['documentation.config.json']=configText??json(config);
 overlay[STATE]=json({version:VERSION,hashes});
 const original=reader.read(config.instruction,1048576);
 const instruction=instructionSection(original??'# Project instructions\n');
 const index=reader.read(config.index,1048576);
 if(index!==null&&!index.startsWith(INDEX_MARKER+'\n')&&!index.startsWith(INDEX_MARKER+'\r\n')){
  if(!options.adoptIndex&&!legacyIndex(index,config,reader))throw new Error(`Existing index requires --adopt-index: ${config.index}`);
  overlay[config.index]=INDEX_MARKER+'\n';
 }
 overlay[config.instruction]=instruction;
 for(const name of Object.keys(overlay))reader.validatePath(name);
 const result=build(reader.root,{overlay});
 const writes={...overlay};delete writes[config.index];
 if(options.refresh!==false)Object.assign(writes,result.outputs);
 else {
  if(original===null&&options.createInstruction===false)delete writes[config.instruction];
  // Deferred full setup must make an existing adopted index readable by its later generator.
  // This promotion never creates an absent index and leaves already owned indexes alone.
  if(Object.hasOwn(overlay,config.index))writes[config.index]=result.outputs[config.index];
 }
 // Even deferred outputs were rendered and validated; only the selected writes apply.
 const finalReader=working(reader.root,{...overlay,...result.outputs});
 for(const name of Object.keys(writes))finalReader.validatePath(name);
 const hook=options.hook?planHook(reader.root):null;
 for(const [name,content]of Object.entries(writes)){const file=path.join(reader.root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content,'utf8');}
 if(hook)applyHook(hook);
 return {version:VERSION,previousVersion:state?.version??null,hashes,config,missing:result.missing,hook,written:Object.keys(writes)};
}
function cli(args){
 const options={};let target;
 for(const arg of args){if(arg.startsWith('--target=')){target=arg.slice(9);if(!target)throw new Error('--target requires a path');}
  else if(arg.startsWith('--instruction=')){options.instruction=arg.slice(14);if(!options.instruction)throw new Error('--instruction requires a value');}
  else if(arg.startsWith('--sources=')){options.sources=arg.slice(10);if(!options.sources)throw new Error('--sources requires a value');}
  else if(arg.startsWith('--docs=')){options.docs=arg.slice(7);if(!options.docs)throw new Error('--docs requires a value');}
  else if(arg==='--adopt-index')options.adoptIndex=true;else if(arg==='--hook')options.hook=true;else throw new Error(`Unknown argument: ${arg}`);
 }
 if(!target)throw new Error('--target=<path> is required');const result=install(target,options);
 console.log(`Documentation installed: ${result.previousVersion&&result.previousVersion!==VERSION?result.previousVersion+' -> ':''}${VERSION}, ${FILES.length} scripts.`);
 if(result.hook&&!result.hook.installed)console.log(`Existing hook configuration preserved. Integration command: ${result.hook.command}`);
}
if(require.main===module){try{cli(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={install,cli,FILES,VERSION};
