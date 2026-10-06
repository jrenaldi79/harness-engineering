#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {working,staged,safeRelative,within,lexical} = require('./filesystem');
const {parseJSON,parseCatalog,parseFrontmatter} = require('./metadata');
const {INDEX_MARKER,renderIndex,renderInstruction} = require('./render');
const defaults={version:1,sourceRoots:['src','lib','app','scripts'],docsRoot:'docs',instruction:'CLAUDE.md',index:'docs/index.md',strict:false};
function validateConfig(config) {
  if(!config || typeof config!=='object' || Array.isArray(config))throw new Error('Invalid documentation config');
  for(const key of Object.keys(config))if(!Object.hasOwn(defaults,key) && key!=='managedMarkers')throw new Error(`Unknown config key: ${key}`);
  for(const key of Object.keys(defaults))if(!Object.hasOwn(config,key))throw new Error(`Missing config key: ${key}`);
  if(config.version!==1)throw new Error('Unsupported documentation config version');
  if(typeof config.strict!=='boolean')throw new Error('Invalid config strict value');
  if(!Array.isArray(config.sourceRoots) || config.sourceRoots.some(x=>typeof x!=='string'))throw new Error('Invalid config source roots');
  safeRelative(config.docsRoot);safeRelative(config.index);
  if(!within(config.index,config.docsRoot) || config.index===config.docsRoot || !config.index.endsWith('.md') || config.index===config.docsRoot+'/catalog.json')throw new Error('Config index must be a .md file inside docs root and cannot be catalog.json');
  if(!['CLAUDE.md','AGENTS.md'].includes(config.instruction))throw new Error('Config instruction must be CLAUDE.md or AGENTS.md');
  if(Object.hasOwn(config,'managedMarkers') && (!Array.isArray(config.managedMarkers) || !config.managedMarkers.includes('docs') || new Set(config.managedMarkers).size!==config.managedMarkers.length || config.managedMarkers.some(name=>!['docs','tree','modules'].includes(name))))throw new Error('Invalid managedMarkers config: use distinct docs/tree/modules names and include docs');
  const roots=[config.docsRoot,...config.sourceRoots];roots.forEach(safeRelative);
  for(const root of roots)for(const control of ['documentation.config.json',config.instruction])if(within(root.toLowerCase(),control.toLowerCase()))throw new Error('Config roots cannot alias control or instruction files');
  for(let a=0;a<roots.length;a++)for(let b=a+1;b<roots.length;b++) {
    const x=roots[a].toLowerCase(),y=roots[b].toLowerCase();if(within(x,y)||within(y,x))throw new Error('Config roots must be distinct and disjoint');
  }
  return {...config,sourceRoots:[...config.sourceRoots],...(Object.hasOwn(config,'managedMarkers')?{managedMarkers:[...config.managedMarkers]}:{})};
}
function loadConfig(reader) {
  const content=reader.read('documentation.config.json',65536);
  if(content===null)throw new Error('Missing documentation.config.json');
  return validateConfig(parseJSON(content,'config'));
}
function buildFromReader(reader,config=loadConfig(reader),options={}) {
  config=validateConfig(config);
  for(const name of [config.docsRoot,config.index,config.instruction,...config.sourceRoots])reader.validatePath(name);
  const catalogPath=config.docsRoot+'/catalog.json';
  const catalog=parseCatalog(reader.read(catalogPath,262144));
  const documents=[],missing=[];
  for(const name of reader.files(config.docsRoot)) {
    if(name.toLowerCase()===config.index.toLowerCase() || name.toLowerCase()===catalogPath.toLowerCase())continue;
    const key=name.slice(config.docsRoot.length+1);
    const front=name.toLowerCase().endsWith('.md')?parseFrontmatter(reader.read(name,16384,true),name):null;
    const listed=catalog[key];
    if(front && listed && JSON.stringify(front)!==JSON.stringify(listed))throw new Error(`Conflicting metadata: ${name}`);
    const metadata=front||listed||null;documents.push({path:name,metadata});if(!metadata)missing.push(name);
  }
  if((options.strict||config.strict) && missing.length)throw new Error(`Missing metadata: ${missing.join(', ')}`);
  const sources=config.sourceRoots.flatMap(scope=>reader.files(scope)).sort(lexical);
  const instruction=reader.read(config.instruction,1048576);
  if(instruction===null)throw new Error(`Missing instruction file with AUTO:docs markers: ${config.instruction}`);
  const existingIndex=reader.read(config.index,1048576);
  if(existingIndex!==null && !existingIndex.startsWith(INDEX_MARKER+'\n') && !existingIndex.startsWith(INDEX_MARKER+'\r\n'))throw new Error(`Index ownership requires Generated marker: ${config.index}`);
  const renderedIndex=renderIndex(documents,config.docsRoot,config.index,sources);
  const outputs={
    [config.index]:existingIndex?.includes('\r\n')?renderedIndex.replace(/\n/g,'\r\n'):renderedIndex,
    [config.instruction]:renderInstruction(instruction,sources,config)
  };
  for(const [name,content] of Object.entries(outputs))if(Buffer.byteLength(content,'utf8')>1048576)throw new Error(`Generated output exceeds 1 MiB limit: ${name}. Reduce the configured source/doc inventory or authored instruction size.`);
  return {outputs,missing,config};
}
function build(root,options={}) {
  const reader=options.reader || (options.staged?staged(root):working(root,options.overlay));
  return buildFromReader(reader,loadConfig(reader),options);
}
function generate(root,options={}) {
  const reader=options.staged?staged(root):working(root);
  const {outputs,missing}=buildFromReader(reader,loadConfig(reader),options);
  for(const name of Object.keys(outputs))reader.validatePath(name);
  if(options.check||options.staged) {
    const stale=Object.entries(outputs).filter(([name,content])=>reader.read(name,1048576)!==content).map(([name])=>name);
    if(stale.length)throw new Error(`Stale generated documentation: ${stale.join(', ')}`);
  } else {
    for(const [name,content] of Object.entries(outputs)) {const absolute=path.join(reader.root,name);fs.mkdirSync(path.dirname(absolute),{recursive:true});fs.writeFileSync(absolute,content,'utf8');}
  }
  return {outputs,missing};
}
function cli(args) {
  const options={};let root=process.cwd();
  for(const arg of args) {
    if(arg.startsWith('--root=')) {root=arg.slice(7);if(!root)throw new Error('--root requires a path');}
    else if(['--check','--staged','--strict'].includes(arg))options[arg.slice(2)]=true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  const result=generate(root,options);
  console.log(`Documentation ${options.check||options.staged?'checked':'refreshed'}: ${Object.keys(result.outputs).length} outputs, ${result.missing.length} unclassified.`);
}
if(require.main===module) {try {cli(process.argv.slice(2));} catch(error) {console.error(error.message);process.exitCode=1;}}
module.exports={generate,build,buildFromReader,loadConfig,validateConfig,defaults,cli};
