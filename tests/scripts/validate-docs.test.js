/**
 * Tests for skills/setup/scripts/lib/validate-docs.js
 *
 * Validates extractSection, findFilesInSection, checkDrift,
 * and checkStagedFilesDrift functions for CLAUDE.md drift detection.
 */

'use strict';

const {
  extractSection,
  findFilesInSection,
  checkDrift,
  checkStagedFilesDrift,
} = require('../../skills/setup/scripts/lib/validate-docs');

// ---------------------------------------------------------------------------
// extractSection
// ---------------------------------------------------------------------------
describe('extractSection', () => {
  it('extracts content between headings of same level', () => {
    const md = [
      '## First',
      'content of first',
      '## Second',
      'content of second',
    ].join('\n');
    expect(extractSection(md, 'First')).toBe('content of first');
  });

  it('extracts content up to a higher-level heading', () => {
    const md = [
      '### Deep',
      'deep content',
      '## Shallow',
      'shallow content',
    ].join('\n');
    expect(extractSection(md, 'Deep')).toBe('deep content');
  });

  it('includes sub-headings within the section', () => {
    const md = [
      '## Main',
      'intro',
      '### Sub',
      'sub content',
      '## Next',
    ].join('\n');
    const result = extractSection(md, 'Main');
    expect(result).toContain('intro');
    expect(result).toContain('### Sub');
    expect(result).toContain('sub content');
  });

  it('returns empty string for non-existent section', () => {
    expect(extractSection('## Other\ncontent', 'Missing')).toBe('');
  });

  it('extracts to end of document if no closing heading', () => {
    const md = '## Only\ncontent here\nmore content';
    expect(extractSection(md, 'Only')).toBe('content here\nmore content');
  });

  it('handles h1 level headings', () => {
    const md = '# Title\nbody\n# Next';
    expect(extractSection(md, 'Title')).toBe('body');
  });
});

// ---------------------------------------------------------------------------
// findFilesInSection
// ---------------------------------------------------------------------------
describe('findFilesInSection', () => {
  it('finds .js filenames in text', () => {
    const section = 'Uses `server.js` and `utils.js` for routing.';
    const files = findFilesInSection(section);
    expect(files).toContain('server.js');
    expect(files).toContain('utils.js');
  });

  it('finds filenames in table rows', () => {
    const section = '| `src/check-secrets.js` | Secret scanner |';
    const files = findFilesInSection(section);
    expect(files).toContain('check-secrets.js');
  });

  it('deduplicates filenames', () => {
    const section = 'file.js mentioned twice: file.js';
    const files = findFilesInSection(section);
    expect(files.filter(f => f === 'file.js')).toHaveLength(1);
  });

  it('returns empty array for no .js files', () => {
    expect(findFilesInSection('no javascript here')).toHaveLength(0);
  });

  it('finds files in code blocks', () => {
    const section = '```\nnode scripts/run.js\n```';
    const files = findFilesInSection(section);
    expect(files).toContain('run.js');
  });
});

// ---------------------------------------------------------------------------
// checkDrift
// ---------------------------------------------------------------------------
describe('checkDrift', () => {
  it('returns empty arrays when docs match disk', () => {
    const result = checkDrift(['a.js', 'b.js'], ['a.js', 'b.js']);
    expect(result.missingFromDocs).toHaveLength(0);
    expect(result.missingFromDisk).toHaveLength(0);
  });

  it('detects files missing from docs', () => {
    const result = checkDrift(['a.js'], ['a.js', 'b.js']);
    expect(result.missingFromDocs).toContain('b.js');
    expect(result.missingFromDisk).toHaveLength(0);
  });

  it('detects files missing from disk', () => {
    const result = checkDrift(['a.js', 'deleted.js'], ['a.js']);
    expect(result.missingFromDisk).toContain('deleted.js');
    expect(result.missingFromDocs).toHaveLength(0);
  });

  it('detects both types of drift simultaneously', () => {
    const result = checkDrift(['old.js'], ['new.js']);
    expect(result.missingFromDocs).toContain('new.js');
    expect(result.missingFromDisk).toContain('old.js');
  });

  it('handles empty arrays', () => {
    const result = checkDrift([], []);
    expect(result.missingFromDocs).toHaveLength(0);
    expect(result.missingFromDisk).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// checkStagedFilesDrift
// ---------------------------------------------------------------------------
describe('checkStagedFilesDrift', () => {
  it('warns when src/ files staged but CLAUDE.md is not', () => {
    const result = checkStagedFilesDrift(['src/new-file.js']);
    expect(result.warn).toBe(true);
    expect(result.changedFiles).toContain('src/new-file.js');
  });

  it('warns when scripts/ files staged but CLAUDE.md is not', () => {
    const result = checkStagedFilesDrift(['scripts/deploy.sh']);
    expect(result.warn).toBe(true);
  });

  it('warns when bin/ files staged but CLAUDE.md is not', () => {
    const result = checkStagedFilesDrift(['bin/cli.js']);
    expect(result.warn).toBe(true);
  });

  it('does not warn when CLAUDE.md is also staged', () => {
    const result = checkStagedFilesDrift(['src/new.js', 'CLAUDE.md']);
    expect(result.warn).toBe(false);
  });

  it('does not warn for untracked directory changes', () => {
    const result = checkStagedFilesDrift(['docs/readme.md', 'package.json']);
    expect(result.warn).toBe(false);
  });

  it('does not warn when no files are staged', () => {
    const result = checkStagedFilesDrift([]);
    expect(result.warn).toBe(false);
  });

  it('detects nested CLAUDE.md in staged files', () => {
    const result = checkStagedFilesDrift(['src/new.js', 'subdir/CLAUDE.md']);
    expect(result.warn).toBe(false);
  });
});
