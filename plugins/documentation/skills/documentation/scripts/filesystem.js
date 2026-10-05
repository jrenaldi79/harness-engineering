'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
function decode(bytes,name,prefix=false) {
  try {return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes,{stream:prefix});}
  catch {throw new Error(`Invalid UTF-8: ${name}`);}
}
const blocked = new Set(['private','secrets','runs','outputs','fixtures','node_modules','__pycache__','cache','caches','build','builds','dist','coverage']);
const lexical = (a,b) => a < b ? -1 : a > b ? 1 : 0;
function allowed(name) { return name.split('/').every(p=>!p.startsWith('.') && !blocked.has(p.toLowerCase())); }
function safeRelative(name) {
  if (typeof name!=='string' || !name || name.includes('\\') || /[\x00-\x1f\x7f:<>"|?*]/.test(name) || path.posix.isAbsolute(name) || name.split('/').some(p=>!p || p==='.' || p==='..' || /[. ]$/.test(p) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)) || !allowed(name)) throw new Error(`Unsafe path: ${name}`);
  return name;
}
function within(name, scope) { return name===scope || name.startsWith(scope+'/'); }
function safeAbsolute(root) {
  root=path.resolve(root);
  let current=path.parse(root).root;
  for(const part of root.slice(current.length).split(path.sep).filter(Boolean)) {
    current=path.join(current,part);
    const info=fs.lstatSync(current);
    if(info.isSymbolicLink()) throw new Error(`Filesystem link in root: ${current}`);
    if(!info.isDirectory()) throw new Error(`Not a directory: ${current}`);
  }
  return root;
}
function working(root, overlay={}) {
  root=safeAbsolute(root);
  for(const name of Object.keys(overlay)) safeRelative(name);
  function validatePath(name) {
    safeRelative(name); let current=root;
    for(const [i,part] of name.split('/').entries()) {
      current=path.join(current,part);
      let info; try {info=fs.lstatSync(current);} catch(error) {if(error.code==='ENOENT') continue; throw error;}
      if(info.isSymbolicLink()) throw new Error(`Filesystem link: ${name}`);
      if(i<name.split('/').length-1 && !info.isDirectory()) throw new Error(`Non-directory parent: ${name}`);
      if(i===name.split('/').length-1 && !info.isFile() && !info.isDirectory()) throw new Error(`Non-regular path: ${name}`);
    }
  }
  function files(scope) {
    validatePath(scope); const found=new Set();
    function walk(name) {
      const absolute=path.join(root,name); let info;
      try { info=fs.lstatSync(absolute); } catch(error) {if(error.code==='ENOENT')return; throw error;}
      if(info.isSymbolicLink()) throw new Error(`Filesystem link: ${name}`);
      if(info.isFile()) { found.add(name); return; }
      if(!info.isDirectory()) throw new Error(`Non-regular path: ${name}`);
      for(const entry of fs.readdirSync(absolute).sort(lexical)) {const child=name+'/'+entry; if(allowed(child)) {safeRelative(child); walk(child);}}
    }
    walk(scope);
    for(const [name,content] of Object.entries(overlay)) if(within(name,scope)) {if(content===null)found.delete(name); else found.add(name);}
    return [...found].sort(lexical);
  }
  function read(name,limit=262144,prefix=false) {
    validatePath(name);
    if(Object.hasOwn(overlay,name)) {
      if(overlay[name]===null)return null;
      const bytes=Buffer.from(overlay[name]); if(!prefix && bytes.length>limit)throw new Error(`Bounded read exceeded: ${name}`);
      return decode(bytes.subarray(0,limit),name,prefix);
    }
    let info; try {info=fs.lstatSync(path.join(root,name));} catch(error) {if(error.code==='ENOENT')return null; throw error;}
    if(!info.isFile())throw new Error(`Not a regular file: ${name}`);
    if(!prefix && info.size>limit)throw new Error(`Bounded read exceeded: ${name}`);
    const fd=fs.openSync(path.join(root,name),'r');
    try {const bytes=Buffer.alloc(Math.min(info.size,limit)); const count=fs.readSync(fd,bytes,0,bytes.length,0); return decode(bytes.subarray(0,count),name,prefix);}
    finally {fs.closeSync(fd);}
  }
  return {root,files,read,validatePath};
}
function staged(root) {
  root=safeAbsolute(root);
  function git(args,limit=16777216,prefix=false) {
    const result=spawnSync('git',args,{cwd:root,maxBuffer:limit,windowsHide:true});
    if(result.error && !(prefix && result.error.code==='ENOBUFS' && result.stdout)) throw new Error(`Git index read failed: ${result.error.message}`);
    if(result.status!==0 && !(prefix && result.error?.code==='ENOBUFS')) throw new Error('Git index read failed: '+String(result.stderr||'').trim());
    return result.stdout.subarray(0,limit);
  }
  const entries=new Map();
  for(const item of decode(git(['ls-files','--stage','-z']),'Git index').split('\0').filter(Boolean)) {
    const match=/^(\d{6}) ([0-9a-f]{40,64}) ([0-3])\t([\s\S]+)$/.exec(item);
    if(!match)throw new Error('Malformed Git index entry');
    const record={mode:match[1],sha:match[2],stage:match[3]}; const name=match[4];
    if(entries.has(name)) entries.get(name).push(record); else entries.set(name,[record]);
  }
  function validatePath(name) {
    safeRelative(name);
    for(const [entry,records] of entries) if(within(name,entry)) {
      if(records.length!==1 || records[0].stage!=='0')throw new Error(`Unresolved Git index stage: ${entry}`);
      if(!['100644','100755'].includes(records[0].mode))throw new Error(`Non-regular Git mode: ${entry}`);
      if(name!==entry)throw new Error(`Git file used as parent: ${entry}`);
    }
  }
  function files(scope) {
    validatePath(scope); const names=[];
    for(const name of entries.keys()) if(within(name,scope) && allowed(name)) {validatePath(name); names.push(name);}
    return names.sort(lexical);
  }
  function read(name,limit=262144,prefix=false) {
    validatePath(name); const record=entries.get(name)?.[0]; if(!record)return null;
    if(!prefix && Number(git(['cat-file','-s',record.sha]).toString('utf8').trim())>limit)throw new Error(`Bounded read exceeded: ${name}`);
    return decode(git(['cat-file','blob',record.sha],limit,prefix),name,prefix);
  }
  return {root,files,read,validatePath};
}
module.exports={working,staged,safeRelative,safeAbsolute,within,allowed,lexical};
