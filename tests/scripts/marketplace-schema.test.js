/**
 * Tests for .claude-plugin/marketplace.json schema validity.
 *
 * Validates that the marketplace manifest conforms to the expected schema
 * so that `/plugin marketplace add` can install the plugin without errors.
 *
 * Can be run standalone: node tests/scripts/marketplace-schema.test.js
 * Or via Jest if a jest config is present.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const MARKETPLACE_PATH = path.resolve(
  __dirname,
  '../../.claude-plugin/marketplace.json'
);

const SOURCE_RE = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

function validate() {
  const raw = fs.readFileSync(MARKETPLACE_PATH, 'utf8');
  const manifest = JSON.parse(raw);
  const errors = [];

  // Required top-level fields
  for (const field of ['name', 'description', 'owner', 'plugins']) {
    if (!(field in manifest)) {
      errors.push(`missing required field: ${field}`);
    }
  }

  if (typeof manifest.name !== 'string' || !manifest.name) {
    errors.push('name must be a non-empty string');
  }

  if (typeof manifest.description !== 'string' || !manifest.description) {
    errors.push('description must be a non-empty string');
  }

  // owner must be an object with a name string
  if (
    typeof manifest.owner !== 'object' ||
    manifest.owner === null ||
    Array.isArray(manifest.owner)
  ) {
    errors.push(`owner must be an object, got ${typeof manifest.owner}`);
  } else if (typeof manifest.owner.name !== 'string' || !manifest.owner.name) {
    errors.push('owner.name must be a non-empty string');
  }

  // plugins must be a non-empty array
  if (!Array.isArray(manifest.plugins) || manifest.plugins.length === 0) {
    errors.push('plugins must be a non-empty array');
  } else {
    for (let i = 0; i < manifest.plugins.length; i++) {
      const p = manifest.plugins[i];
      const prefix = `plugins[${i}]`;

      for (const field of ['name', 'description', 'source']) {
        if (typeof p[field] !== 'string' || !p[field]) {
          errors.push(`${prefix}.${field} must be a non-empty string`);
        }
      }

      if (typeof p.source === 'string' && !SOURCE_RE.test(p.source)) {
        errors.push(
          `${prefix}.source must match owner/repo format, got "${p.source}"`
        );
      }
    }
  }

  return errors;
}

// Support both standalone execution and Jest
if (typeof describe === 'function') {
  // Jest environment
  describe('marketplace.json schema', () => {
    it('passes all schema validations', () => {
      const errors = validate();
      if (errors.length > 0) {
        throw new Error('Schema errors:\n  - ' + errors.join('\n  - '));
      }
    });
  });
} else {
  // Standalone execution
  const errors = validate();
  if (errors.length > 0) {
    console.error('marketplace.json schema errors:');
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
  }
  console.log('marketplace.json schema OK');
}
