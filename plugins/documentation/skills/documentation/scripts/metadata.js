'use strict';
const {safeRelative} = require('./filesystem');
const fields=['title','description','type','status','read_when'];
const types=['guidance','status','reference','proposal','generated','history','temporary'];
const statuses=['maintained','snapshot','pending','completed','abandoned','superseded','temporary','generated'];
// Reject duplicate JSON keys before they can be silently discarded by JSON.parse.
function parseJSON(text,label='JSON') {
  let i=0;
  const space=()=>{while(/[ \t\r\n]/.test(text[i]||'') && i<text.length)i++;};
  function string() {
    space(); const start=i++; if(text[start]!== '"')throw new Error(`Invalid ${label} JSON`);
    while(i<text.length) {if(text[i]==='\\')i+=2; else if(text[i++]==='"')return JSON.parse(text.slice(start,i));}
    throw new Error(`Invalid ${label} JSON`);
  }
  function value() {
    space(); const start=i;
    if(text[i]==='"')return string();
    if(text[i]==='{') {
      i++; space(); const out=Object.create(null);
      if(text[i]==='}') {i++;return out;}
      while(i<text.length) {const key=string(); if(Object.hasOwn(out,key))throw new Error(`Duplicate ${label} key: ${key}`); space(); if(text[i++]!==':')throw new Error(`Invalid ${label} JSON`); out[key]=value(); space(); const end=text[i++]; if(end==='}')return out; if(end!==',')break;}
    } else if(text[i]==='[') {
      i++; space(); const out=[]; if(text[i]===']'){i++;return out;}
      while(i<text.length){out.push(value());space();const end=text[i++];if(end===']')return out;if(end!==',')break;}
    } else {
      const token=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(start));
      if(token){i+=token[0].length;return JSON.parse(token[0]);}
    }
    throw new Error(`Invalid ${label} JSON`);
  }
  const result=value();space();if(i!==text.length)throw new Error(`Invalid ${label} JSON`);return result;
}
function normalizeMetadata(record,name,legacy=false) {
  if(!record || typeof record!=='object' || Array.isArray(record))throw new Error(`Invalid metadata: ${name}`);
  const keys=Object.keys(record).sort();
  if(legacy && keys.join(',')==='note,status,title,type') record={title:record.title,description:record.note,type:record.type,status:record.status,read_when:'When working with this document.'};
  for(const key of Object.keys(record))if(!fields.includes(key))throw new Error(`Unknown metadata field ${key}: ${name}`);
  const output={};
  for(const key of fields) {const value=record[key]; if(typeof value!=='string' || !value.trim() || /[\r\n\x00-\x1f\x7f]/.test(value))throw new Error(`Invalid metadata field ${key}: ${name}`); output[key]=value;}
  if(!types.includes(output.type))throw new Error(`Invalid metadata type: ${name}`);
  if(!statuses.includes(output.status))throw new Error(`Invalid metadata status: ${name}`);
  return output;
}
function parseFrontmatter(text,name) {
  text=text.replace(/^\uFEFF/,''); const lines=text.split(/\r?\n/);
  if(lines[0]!=='---')return null;
  const end=lines.indexOf('---',1); if(end<0)throw new Error(`Unterminated bounded frontmatter: ${name}`);
  const record=Object.create(null);
  for(const line of lines.slice(1,end)) {
    const match=/^([a-z_]+):[ \t]*(.*)$/.exec(line); if(!match)throw new Error(`Malformed frontmatter: ${name}`);
    const [,key,raw]=match;if(Object.hasOwn(record,key))throw new Error(`Duplicate frontmatter field ${key}: ${name}`);
    if(raw.startsWith('"')) {try {record[key]=JSON.parse(raw);} catch {throw new Error(`Malformed frontmatter string: ${name}`);}}
    else {if(!raw.trim() || raw!==raw.trim() || /^[\[\]{}&*!|>'%@`?-]/.test(raw) || /[:#]/.test(raw))throw new Error(`Malformed frontmatter string: ${name}`);record[key]=raw;}
  }
  return normalizeMetadata(record,name);
}
function parseCatalog(text) {
  if(text===null)return Object.create(null);
  const records=parseJSON(text,'catalog');if(!records || typeof records!=='object' || Array.isArray(records))throw new Error('Invalid catalog object');
  const output=Object.create(null);
  for(const [name,record] of Object.entries(records)) {safeRelative(name); output[name]=normalizeMetadata(record,name,true);}
  return output;
}
module.exports={fields,types,statuses,parseJSON,normalizeMetadata,parseFrontmatter,parseCatalog};
