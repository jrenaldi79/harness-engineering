/**
 * Tests for skills/setup/scripts/lib/check-secrets.js
 *
 * Validates scanForSecrets and matchesAllowlist functions
 * that detect hardcoded API keys and tokens.
 */

'use strict';

const { scanForSecrets, matchesAllowlist } = require('../../skills/setup/scripts/lib/check-secrets');

// ---------------------------------------------------------------------------
// matchesAllowlist
// ---------------------------------------------------------------------------
describe('matchesAllowlist', () => {
  const defaultAllowlist = ['tests/**', '**/*.test.js', '**/*.spec.js', '**/*.md', 'docs/**'];

  it('allows files in tests/ subdirectory', () => {
    expect(matchesAllowlist('tests/unit/auth.js', defaultAllowlist)).toBe(true);
  });

  it('allows nested *.test.js files', () => {
    expect(matchesAllowlist('src/auth.test.js', defaultAllowlist)).toBe(true);
  });

  it('allows nested *.spec.js files', () => {
    expect(matchesAllowlist('src/auth.spec.js', defaultAllowlist)).toBe(true);
  });

  it('allows nested markdown files', () => {
    expect(matchesAllowlist('docs/guide.md', defaultAllowlist)).toBe(true);
  });

  it('allows root-level markdown files', () => {
    expect(matchesAllowlist('README.md', defaultAllowlist)).toBe(true);
  });

  it('allows docs directory files', () => {
    expect(matchesAllowlist('docs/setup.txt', defaultAllowlist)).toBe(true);
  });

  it('does not allow regular source files', () => {
    expect(matchesAllowlist('src/config.js', defaultAllowlist)).toBe(false);
  });

  it('does not allow .env files', () => {
    expect(matchesAllowlist('.env', defaultAllowlist)).toBe(false);
  });

  it('allows spec files directly in src/', () => {
    expect(matchesAllowlist('src/auth.spec.js', defaultAllowlist)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// scanForSecrets — Anthropic keys
// ---------------------------------------------------------------------------
describe('scanForSecrets — Anthropic keys (sk-ant-)', () => {
  it('detects sk-ant- pattern', () => {
    const content = 'const key = "sk-ant-abc123def456";\n';
    const results = scanForSecrets(content, 'src/config.js');
    expect(results).toHaveLength(1);
    expect(results[0].pattern).toBe('sk-ant-');
    expect(results[0].line).toBe(1);
  });

  it('detects on correct line number', () => {
    const content = 'line1\nline2\nconst key = "sk-ant-abc123";\n';
    const results = scanForSecrets(content, 'src/config.js');
    expect(results[0].line).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// scanForSecrets — OpenRouter keys
// ---------------------------------------------------------------------------
describe('scanForSecrets — OpenRouter keys (sk-or-)', () => {
  it('detects sk-or- pattern', () => {
    const content = 'const key = "sk-or-abc123def456";\n';
    const results = scanForSecrets(content, 'src/config.js');
    expect(results).toHaveLength(1);
    expect(results[0].pattern).toBe('sk-or-');
  });
});

// ---------------------------------------------------------------------------
// scanForSecrets — AWS keys
// ---------------------------------------------------------------------------
describe('scanForSecrets — AWS keys (AKIA)', () => {
  it('detects AWS access key', () => {
    const content = 'AWS_KEY=AKIAIOSFODNN7EXAMPLE\n';
    const results = scanForSecrets(content, 'src/config.js');
    expect(results).toHaveLength(1);
    expect(results[0].pattern).toBe('AKIA');
  });

  it('does not match partial AKIA prefix without 16 chars', () => {
    const content = 'AKIA_SHORT\n';
    const results = scanForSecrets(content, 'src/config.js');
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// scanForSecrets — GitHub PATs
// ---------------------------------------------------------------------------
describe('scanForSecrets — GitHub PATs (ghp_)', () => {
  it('detects GitHub personal access token', () => {
    const content = 'token = "ghp_ABCDEFghij1234567890";\n';
    const results = scanForSecrets(content, 'src/config.js');
    expect(results).toHaveLength(1);
    expect(results[0].pattern).toBe('ghp_');
  });

  it('does not match ghp_ with too few chars', () => {
    const content = 'ghp_short\n';
    const results = scanForSecrets(content, 'src/config.js');
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// scanForSecrets — Private keys
// ---------------------------------------------------------------------------
describe('scanForSecrets — private keys', () => {
  it('detects RSA private key header', () => {
    const content = '-----BEGIN RSA PRIVATE KEY-----\n';
    const results = scanForSecrets(content, 'src/config.js');
    expect(results).toHaveLength(1);
    expect(results[0].pattern).toBe('BEGIN.*KEY');
  });

  it('detects EC private key header', () => {
    const content = '-----BEGIN EC PRIVATE KEY-----\n';
    const results = scanForSecrets(content, 'src/config.js');
    expect(results).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// scanForSecrets — allowlist bypass
// ---------------------------------------------------------------------------
describe('scanForSecrets — allowlist', () => {
  it('skips allowlisted files even if they contain secrets', () => {
    const content = 'const key = "sk-ant-abc123def456";\n';
    expect(scanForSecrets(content, 'tests/fixtures/keys.js')).toHaveLength(0);
    expect(scanForSecrets(content, 'src/auth.test.js')).toHaveLength(0);
    expect(scanForSecrets(content, 'README.md')).toHaveLength(0);
    expect(scanForSecrets(content, 'docs/secrets.txt')).toHaveLength(0);
  });

  it('scans non-allowlisted files', () => {
    const content = 'const key = "sk-ant-abc123def456";\n';
    expect(scanForSecrets(content, 'src/config.js')).toHaveLength(1);
  });

  it('supports custom allowlist via options', () => {
    const content = 'const key = "sk-ant-abc123def456";\n';
    const results = scanForSecrets(content, 'src/config.js', {
      allowlistPaths: ['src/*'],
    });
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// scanForSecrets — clean files
// ---------------------------------------------------------------------------
describe('scanForSecrets — clean files', () => {
  it('returns empty array for clean content', () => {
    const content = 'const greeting = "hello world";\nmodule.exports = { greeting };\n';
    expect(scanForSecrets(content, 'src/index.js')).toHaveLength(0);
  });

  it('does not false-positive on similar-looking strings', () => {
    const content = 'const msg = "sk-something-else";\n';
    expect(scanForSecrets(content, 'src/index.js')).toHaveLength(0);
  });

  it('detects multiple secrets in one file', () => {
    const content = [
      'const key1 = "sk-ant-abc123def456";',
      'const key2 = "ghp_ABCDEFghij1234567890";',
    ].join('\n') + '\n';
    const results = scanForSecrets(content, 'src/config.js');
    expect(results).toHaveLength(2);
  });
});
