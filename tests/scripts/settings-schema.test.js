/**
 * Schema checks for Claude Code settings shipped by /setup and used by this repo.
 *
 * Permission rules must be `Tool` or `Tool(specifier)`; a bare command string such
 * as "npm test" is read as a tool name and silently matches nothing. Hooks must be
 * nested as event -> matcher groups -> `hooks` handler array.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const FILES = [
  'skills/setup/templates/settings.json',
  '.claude/settings.json',
];
const RULE = /^[A-Z][A-Za-z]*(\(.+\))?$/;

const load = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

describe.each(FILES)('%s', file => {
  const settings = load(file);

  it('uses Tool(specifier) syntax for every allow and deny rule', () => {
    const { allow = [], deny = [] } = settings.permissions;
    const invalid = [...allow, ...deny].filter(rule => !RULE.test(rule));
    expect(invalid).toEqual([]);
  });

  it('nests every hook handler inside a matcher group', () => {
    for (const groups of Object.values(settings.hooks || {})) {
      for (const group of groups) {
        expect(Array.isArray(group.hooks)).toBe(true);
        for (const handler of group.hooks) expect(handler.type).toBe('command');
      }
    }
  });
});

describe('skills/setup/templates/settings.json safety rules', () => {
  const { deny } = load('skills/setup/templates/settings.json').permissions;

  it.each([
    'Read(./.env)',
    'Bash(git push --force:*)',
    'Bash(git reset --hard:*)',
    'Bash(rm -rf /:*)',
  ])('denies %s', rule => {
    expect(deny).toContain(rule);
  });
});
