#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {working}=require('./filesystem');
const {loadConfig,build}=require('./generate');
const {parseCatalog,parseJSON,parseFrontmatter,fields}=require('./metadata');
// Explicit migration is the only operation reading an entire Markdown body, capped at 1 MiB.
const DOCUMENT_LIMIT=1048576;
function migrate(root,options={}){
 if(Number(process.versions.node.split('.')[0])<18)throw new Error('Documentation tooling requires Node.js 18+');
 for(const key of Object.keys(options))if(key!=='write')throw new Error(`Unknown migration option: ${key}`);
 if(Object.hasOwn(options,'write')&&typeof options.write!=='boolean')throw new Error('Invalid write option');
 const reader=working(root),config=loadConfig(reader),catalogPath=config.docsRoot+'/catalog.json';
 const catalogText=reader.read(catalogPath,262144),catalog=parseCatalog(catalogText);
 const remaining={...(catalogText===null?{}:parseJSON(catalogText,'catalog'))},overlay={},changes=[];
 const documents=new Set(reader.files(config.docsRoot));
 for(const [key,record]of Object.entries(catalog)){
  const name=config.docsRoot+'/'+key;if(!documents.has(name)||!name.toLowerCase().endsWith('.md')||name===config.index)continue;
  const text=reader.read(name,DOCUMENT_LIMIT),existing=parseFrontmatter(text,name);
  if(existing&&JSON.stringify(existing)!==JSON.stringify(record))throw new Error(`Conflicting metadata: ${name}`);
  if(!existing){const newline=text.includes('\r\n')?'\r\n':'\n';const bom=text.startsWith('\uFEFF')?'\uFEFF':'';
   overlay[name]=bom+'---'+newline+fields.map(field=>field+': '+JSON.stringify(record[field])).join(newline)+newline+'---'+newline+text.slice(bom.length);
  }
  delete remaining[key];changes.push(name);
 }
 if(changes.length)overlay[catalogPath]=JSON.stringify(remaining,null,2)+'\n';
 build(reader.root,{overlay});for(const name of Object.keys(overlay))reader.validatePath(name);
 if(options.write)for(const [name,content]of Object.entries(overlay))fs.writeFileSync(path.join(reader.root,name),content,'utf8');
 return {changes,written:Boolean(options.write),catalog:catalogPath};
}
function cli(args){let root=process.cwd(),write=false;for(const arg of args){if(arg.startsWith('--root=')){root=arg.slice(7);if(!root)throw new Error('--root requires a path');}else if(arg==='--write')write=true;else throw new Error(`Unknown argument: ${arg}`);}
 const result=migrate(root,{write});console.log(`Migration ${write?'applied':'preview'}: ${result.changes.length} documents.`);for(const name of result.changes)console.log(name);
}
if(require.main===module){try{cli(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={migrate,cli,DOCUMENT_LIMIT};
