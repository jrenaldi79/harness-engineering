/**
 * Tests for .claude-plugin/marketplace.json schema validity.
 *
 * Validates that the marketplace manifest conforms to the expected schema
 * so that `claude plugin marketplace add` can register the marketplace
 * and `claude plugin install` can install plugins from it.
 *
 * Also detects self-referential plugin sources that cause recursive
 * caching (ENAMETOOLONG errors during plugin install).
 *
 * Can be run standalone: node tests/scripts/marketplace-schema.test.js
 * Or via Jest if a jest config is present.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MARKETPLACE_PATH = path.resolve(
  __dirname,
  '../../.claude-plugin/marketplace.json'
);

const VALID_SOURCE_TYPES = ['github', 'url', 'git-subdir', 'npm'];

/**
 * Derive the marketplace's GitHub repo identifier (owner/repo, lowercase)
 * from plugin homepage URLs or the marketplace name. Returns null if the
 * repo cannot be determined.
 */
function deriveMarketplaceRepo(manifest) {
  // Check plugin homepage URLs for GitHub repo references
  if (Array.isArray(manifest.plugins)) {
    for (const p of manifest.plugins) {
      if (typeof p.homepage === 'string') {
        const match = p.homepage.match(
          /github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/|$)/
        );
        if (match) return match[1].toLowerCase();
      }
    }
  }
  return null;
}

function validate() {
  const raw = fs.readFileSync(MARKETPLACE_PATH, 'utf8');
  const manifest = JSON.parse(raw);
  const errors = [];

  // Required top-level fields
  for (const field of ['name', 'owner', 'plugins']) {
    if (!(field in manifest)) {
      errors.push(`missing required field: ${field}`);
    }
  }

  // Disallowed root-level keys
  const allowedRootKeys = ['$schema', 'name', 'owner', 'plugins', 'metadata'];
  for (const key of Object.keys(manifest)) {
    if (!allowedRootKeys.includes(key)) {
      errors.push(`unrecognized root-level key: "${key}" (did you mean to put it in metadata or in a plugin entry?)`);
    }
  }

  if (typeof manifest.name !== 'string' || !manifest.name) {
    errors.push('name must be a non-empty string');
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
    // Derive the marketplace repo from the homepage or known repo name.
    // Used to detect self-referential GitHub sources that cause recursive
    // caching and ENAMETOOLONG errors during plugin install.
    const marketplaceRepo = deriveMarketplaceRepo(manifest);

    for (let i = 0; i < manifest.plugins.length; i++) {
      const p = manifest.plugins[i];
      const prefix = `plugins[${i}]`;

      if (typeof p.name !== 'string' || !p.name) {
        errors.push(`${prefix}.name must be a non-empty string`);
      }

      // source can be a relative path string (e.g. "./plugins/my-plugin")
      // or an object with a source type
      if (typeof p.source === 'string') {
        if (!p.source.startsWith('./')) {
          errors.push(
            `${prefix}.source string must start with "./" (relative path), got "${p.source}"`
          );
        }
      } else if (
        typeof p.source !== 'object' ||
        p.source === null ||
        Array.isArray(p.source)
      ) {
        errors.push(`${prefix}.source must be a string (relative path) or an object`);
      } else if (!VALID_SOURCE_TYPES.includes(p.source.source)) {
        errors.push(
          `${prefix}.source.source must be one of: ${VALID_SOURCE_TYPES.join(', ')} (got "${p.source.source}")`
        );
      } else if (p.source.source === 'github' && marketplaceRepo) {
        // Detect self-referential GitHub sources: when a plugin's GitHub
        // source points to the same repo that hosts the marketplace, Claude
        // Code re-clones the repo inside its own cache on every install,
        // creating deeply nested directories until ENAMETOOLONG.
        const pluginRepo = (p.source.repo || '').toLowerCase();
        if (pluginRepo === marketplaceRepo) {
          errors.push(
            `${prefix}.source is self-referential: GitHub source "${p.source.repo}" ` +
            `points to the same repo as the marketplace. Use a relative path ` +
            `(e.g. "source": "./") instead to avoid recursive caching (ENAMETOOLONG).`
          );
        }
      }
    }
  }

  return errors;
}

// Support both standalone execution and Jest
if (typeof describe === 'function') {
  describe('marketplace.json schema', () => {
    it('passes all schema validations', () => {
      const errors = validate();
      if (errors.length > 0) {
        throw new Error('Schema errors:\n  - ' + errors.join('\n  - '));
      }
    });
  });
} else {
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
