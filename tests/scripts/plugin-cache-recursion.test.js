/**
 * Tests for plugin cache recursion bug (ENAMETOOLONG).
 *
 * Reproduces the recursive caching behavior that occurs when marketplace.json
 * uses a GitHub source pointing to the same repo that hosts the marketplace.
 * Claude Code copies the full repo into ~/.claude/plugins/cache/<name>/<version>/,
 * then processes the marketplace.json found inside the cached copy, re-cloning
 * into a nested subdirectory — repeating until the path exceeds OS limits.
 *
 * This test simulates that caching loop to verify:
 *   1. The OLD config (self-referential GitHub source) triggers ENAMETOOLONG
 *   2. The NEW config (relative path source) does NOT trigger recursion
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PLUGIN_JSON_PATH = path.resolve(
  __dirname,
  '../../.claude-plugin/plugin.json'
);
const MARKETPLACE_JSON_PATH = path.resolve(
  __dirname,
  '../../.claude-plugin/marketplace.json'
);

// Linux max path length (PATH_MAX)
const PATH_MAX = 4096;

/**
 * Simulate Claude Code's plugin caching behavior.
 *
 * When Claude Code installs a plugin from a marketplace:
 *   1. It reads marketplace.json to find the plugin source
 *   2. For GitHub sources, it clones the repo into the cache
 *   3. The cached copy is at: ~/.claude/plugins/cache/<name>/<version>/
 *   4. If the cached copy contains a marketplace.json with a GitHub source
 *      pointing to the same repo, Claude Code clones AGAIN inside the cache
 *   5. This repeats, building paths like:
 *      cache/harness-engineering/1.2.1/harness-engineering/1.2.1/...
 *
 * Returns the path depth at which ENAMETOOLONG would occur, or -1 if
 * no recursion happens.
 */
function simulateCacheRecursion(marketplaceJson, pluginJson) {
  const marketplace = JSON.parse(marketplaceJson);
  const plugin = JSON.parse(pluginJson);

  const pluginName = plugin.name || marketplace.plugins[0].name;
  const pluginVersion = plugin.version || '1.0.0';

  // Base cache path (realistic home directory)
  const baseCachePath = path.join(
    os.homedir(),
    '.claude',
    'plugins',
    'cache'
  );

  let currentPath = baseCachePath;
  let depth = 0;

  for (const entry of marketplace.plugins) {
    // Only GitHub object sources trigger re-cloning
    if (
      typeof entry.source === 'object' &&
      entry.source !== null &&
      entry.source.source === 'github'
    ) {
      // Simulate the recursive caching loop
      while (currentPath.length < PATH_MAX) {
        depth++;
        // Claude Code creates: <cache>/<pluginName>/<version>/
        currentPath = path.join(currentPath, pluginName, pluginVersion);

        // Inside the cached copy, the full repo is present including
        // .claude-plugin/marketplace.json. If Claude Code processes it
        // and finds the same GitHub source, it clones again.
        // The loop continues until the path is too long.
      }
      return { depth, pathLength: currentPath.length, recursion: true };
    }

    // Relative path sources (e.g. "./") don't trigger re-cloning.
    // The plugin is already in the marketplace directory — Claude Code
    // copies it to the cache once and stops.
    if (typeof entry.source === 'string' && entry.source.startsWith('./')) {
      currentPath = path.join(baseCachePath, pluginName, pluginVersion);
      return { depth: 1, pathLength: currentPath.length, recursion: false };
    }
  }

  return { depth: 0, pathLength: currentPath.length, recursion: false };
}

// ─── The OLD marketplace.json (self-referential GitHub source) ───
const OLD_MARKETPLACE = JSON.stringify({
  name: 'harness-engineering',
  owner: { name: 'John Renaldi' },
  plugins: [
    {
      name: 'harness-engineering',
      source: {
        source: 'github',
        repo: 'jrenaldi79/harness-engineering',
      },
      homepage: 'https://github.com/jrenaldi79/harness-engineering',
    },
  ],
});

// ─── Helper: build the old marketplace.json with a given plugin.json ───
function readCurrentPluginJson() {
  return fs.readFileSync(PLUGIN_JSON_PATH, 'utf8');
}

function readCurrentMarketplaceJson() {
  return fs.readFileSync(MARKETPLACE_JSON_PATH, 'utf8');
}

describe('plugin cache recursion (ENAMETOOLONG reproduction)', () => {
  describe('OLD config: self-referential GitHub source', () => {
    it('triggers recursive caching that exceeds PATH_MAX', () => {
      const pluginJson = readCurrentPluginJson();
      const result = simulateCacheRecursion(OLD_MARKETPLACE, pluginJson);

      expect(result.recursion).toBe(true);
      expect(result.pathLength).toBeGreaterThan(PATH_MAX);
      // On Linux, PATH_MAX is 4096. Each nesting adds ~40 chars
      // ("harness-engineering/1.2.1/"), so ~100 levels to overflow.
      expect(result.depth).toBeGreaterThan(10);
    });

    it('reproduces the exact nested directory pattern users reported', () => {
      const pluginJson = readCurrentPluginJson();
      const plugin = JSON.parse(pluginJson);
      const name = plugin.name;
      const version = plugin.version;

      // Build the recursive path manually to show what users saw
      const baseCachePath = path.join(
        os.homedir(),
        '.claude',
        'plugins',
        'cache'
      );
      const segment = path.join(name, version);
      let recursivePath = baseCachePath;
      const nestings = [];

      for (let i = 0; i < 5; i++) {
        recursivePath = path.join(recursivePath, segment);
        nestings.push(recursivePath);
      }

      // This is exactly what the user's /doctor output showed:
      // harness-engineering/1.x.x/harness-engineering/1.x.x/...
      const pattern = new RegExp(
        `(${name}/${version}/){2,}`.replace(/\./g, '\\.')
      );
      expect(recursivePath).toMatch(pattern);

      // After enough nesting, the path blows past filesystem limits
      let fullPath = baseCachePath;
      let depth = 0;
      while (fullPath.length < PATH_MAX) {
        fullPath = path.join(fullPath, segment);
        depth++;
      }
      expect(fullPath.length).toBeGreaterThan(PATH_MAX);
    });

    it('would hit ENAMETOOLONG trying to create a file in the nested cache', () => {
      // Simulate creating an actual file at the recursive path
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-'));

      try {
        const pluginJson = readCurrentPluginJson();
        const plugin = JSON.parse(pluginJson);
        const segment = path.join(plugin.name, plugin.version);

        // Build a path that exceeds filesystem limits
        let deepPath = tmpDir;
        for (let i = 0; i < 200; i++) {
          deepPath = path.join(deepPath, segment);
        }

        // This MUST throw ENAMETOOLONG (or ENOENT on some systems)
        expect(() => {
          fs.mkdirSync(deepPath, { recursive: true });
        }).toThrow();
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('NEW config: relative path source (FIXED)', () => {
    it('does NOT trigger recursive caching', () => {
      const pluginJson = readCurrentPluginJson();
      const marketplaceJson = readCurrentMarketplaceJson();
      const result = simulateCacheRecursion(marketplaceJson, pluginJson);

      expect(result.recursion).toBe(false);
      expect(result.depth).toBe(1);
    });

    it('cache path stays well within PATH_MAX', () => {
      const pluginJson = readCurrentPluginJson();
      const marketplaceJson = readCurrentMarketplaceJson();
      const result = simulateCacheRecursion(marketplaceJson, pluginJson);

      expect(result.pathLength).toBeLessThan(PATH_MAX);
      // A single level: ~/.claude/plugins/cache/harness-engineering/1.2.1/
      // should be well under 200 chars
      expect(result.pathLength).toBeLessThan(200);
    });

    it('uses a relative path source in marketplace.json', () => {
      const marketplaceJson = readCurrentMarketplaceJson();
      const marketplace = JSON.parse(marketplaceJson);

      const plugin = marketplace.plugins[0];
      expect(typeof plugin.source).toBe('string');
      expect(plugin.source).toBe('./');
    });

    it('can create the single-level cache path without errors', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-'));

      try {
        const pluginJson = readCurrentPluginJson();
        const plugin = JSON.parse(pluginJson);

        const cachePath = path.join(tmpDir, plugin.name, plugin.version);

        // This should succeed — single level, short path
        fs.mkdirSync(cachePath, { recursive: true });
        expect(fs.existsSync(cachePath)).toBe(true);

        // Write a marker file to prove it works
        const markerFile = path.join(cachePath, 'plugin.json');
        fs.writeFileSync(markerFile, pluginJson);
        expect(fs.existsSync(markerFile)).toBe(true);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
