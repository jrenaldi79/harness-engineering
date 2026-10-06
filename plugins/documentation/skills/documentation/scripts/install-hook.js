#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {safeAbsolute}=require('./filesystem');
const COMMAND='node scripts/self-documentation/generate.js --staged';
const CONTENT='#!/bin/sh\n# Harness documentation staged validation. Never stages files.\nif ! command -v node >/dev/null 2>&1; then\n  echo "Documentation hook requires Node.js 18+ on PATH." >&2\n  exit 1\nfi\n'+COMMAND+'\n';
function git(root,args){const result=spawnSync('git',['-c','core.quotePath=false',...args],{cwd:root,encoding:'utf8',maxBuffer:65536,windowsHide:true});if(result.error)throw new Error('Git hook preflight failed: '+result.error.message);return result;}
// Verify link-free ancestors before resolving Windows case/8.3 aliases. A hook
// directory may not exist yet, so canonicalize its nearest existing directory.
function canonicalDirectory(name){
 let current=path.resolve(name);const suffix=[];
 for(;;){try{fs.lstatSync(current);break;}catch(error){if(error.code!=='ENOENT')throw error;const parent=path.dirname(current);if(parent===current)throw error;suffix.unshift(path.basename(current));current=parent;}}
 return path.join(fs.realpathSync.native(safeAbsolute(current)),...suffix);
}
function sameDirectory(a,b){const left=canonicalDirectory(a),right=canonicalDirectory(b);return process.platform==='win32'?left.toLowerCase()===right.toLowerCase():left===right;}
function validate(root,file){
 const relative=path.relative(root,file);if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('Hook destination outside target project');
 let current=root;const parts=relative.split(path.sep);
 for(let i=0;i<parts.length;i++){current=path.join(current,parts[i]);let info;try{info=fs.lstatSync(current);}catch(error){if(error.code==='ENOENT')continue;throw error;}
  if(info.isSymbolicLink())throw new Error('Filesystem link in hook destination');if(i<parts.length-1&&!info.isDirectory())throw new Error('Refusing shared worktree or non-default Git hook directory');
  if(i===parts.length-1&&!info.isFile())throw new Error('Hook destination is not a regular file');
 }
}
function planHook(root){
 if(Number(process.versions.node.split('.')[0])<18)throw new Error('Documentation tooling requires Node.js 18+');
 root=fs.realpathSync.native(safeAbsolute(root));
 const gitDir=path.join(root,'.git');let info;try{info=fs.lstatSync(gitDir);}catch{throw new Error('Optional hook requires a Git repository with a default local hook directory');}
 if(info.isSymbolicLink())throw new Error('Filesystem link in Git directory');if(!info.isDirectory())throw new Error('Refusing shared worktree or non-default Git hook directory');
 const top=git(root,['rev-parse','--show-toplevel']);if(top.status!==0||!sameDirectory(top.stdout.trim(),root))throw new Error('Hook target must be the Git project root');
 const configured=git(root,['config','--get','core.hooksPath']);if(![0,1].includes(configured.status))throw new Error('Cannot inspect Git core.hooksPath');
 if(configured.status===0)return {root,installed:false,command:COMMAND,reason:'core.hooksPath is configured'};
 const hooks=git(root,['rev-parse','--git-path','hooks']);
 if(hooks.status!==0||!sameDirectory(path.resolve(root,hooks.stdout.trim()),path.join(gitDir,'hooks')))throw new Error('Refusing shared or outside default Git hook directory');
 const file=path.join(gitDir,'hooks','pre-commit');validate(root,file);
 let existing=null;try{const size=fs.statSync(file).size;if(size>65536)return {root,installed:false,command:COMMAND,reason:'Existing hook'};existing=fs.readFileSync(file,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
 if(existing!==null&&existing!==CONTENT)return {root,installed:false,command:COMMAND,reason:'Existing hook'};
 return {root,file,content:CONTENT,installed:true,command:COMMAND,existing:existing!==null};
}
function applyHook(plan){
 if(!plan.installed)return plan;validate(plan.root,plan.file);
 if(plan.existing){
  if(fs.statSync(plan.file).size>65536||fs.readFileSync(plan.file,'utf8')!==CONTENT)throw new Error('Existing hook changed after preflight');
  fs.chmodSync(plan.file,0o755);
 }else {fs.mkdirSync(path.dirname(plan.file),{recursive:true});fs.writeFileSync(plan.file,plan.content,{encoding:'utf8',mode:0o755,flag:'wx'});}
 return plan;
}
function installHook(root){return applyHook(planHook(root));}
function cli(args){let root=process.cwd();for(const arg of args){if(arg.startsWith('--root=')){root=arg.slice(7);if(!root)throw new Error('--root requires a path');}else throw new Error(`Unknown argument: ${arg}`);}
 const result=installHook(root);console.log(result.installed?'Documentation pre-commit hook installed.':`Existing hook configuration preserved. Integration command: ${COMMAND}`);
}
if(require.main===module){try{cli(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={installHook,planHook,applyHook,cli};
