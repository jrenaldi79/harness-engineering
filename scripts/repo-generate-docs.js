#!/usr/bin/env node
/** Repository entry point for the same documentation engine shipped to projects. */
'use strict';
const path = require('node:path');
const {cli} = require('../plugins/documentation/skills/documentation/scripts/generate');

function main(args = process.argv.slice(2)) {
  const forwarded = ['--root=' + path.resolve(__dirname, '..')];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root') {
      if (!args[i+1]) throw new Error('--root requires a path');
      forwarded.push('--root=' + args[++i]);
    } else forwarded.push(args[i]);
  }
  cli(forwarded);
}
if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = {main};
