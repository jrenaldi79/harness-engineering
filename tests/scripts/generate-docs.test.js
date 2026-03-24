/**
 * Tests for generate-docs.js marker operations: replaceMarkers,
 * validateCrossLinks, buildDocsIndex, and checkMarkersAreCurrent.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  replaceMarkers,
  validateCrossLinks,
  buildDocsIndex,
  checkMarkersAreCurrent,
} = require('../../skills/setup/scripts/lib/generate-docs');

/** Create a temp directory for each test, cleaned up after. */
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-docs-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// replaceMarkers
// ---------------------------------------------------------------------------
describe('replaceMarkers', () => {
  it('replaces content between markers', () => {
    const content = [
      '# Header',
      '<!-- AUTO:tree -->',
      'old tree content',
      '<!-- /AUTO:tree -->',
      '# Footer',
    ].join('\n');

    const result = replaceMarkers(content, 'tree', 'new tree content');
    expect(result).toContain('new tree content');
    expect(result).not.toContain('old tree content');
    expect(result).toContain('<!-- AUTO:tree -->');
    expect(result).toContain('<!-- /AUTO:tree -->');
    expect(result).toContain('# Header');
    expect(result).toContain('# Footer');
  });

  it('preserves content outside markers', () => {
    const content = [
      'before',
      '<!-- AUTO:x -->',
      'old',
      '<!-- /AUTO:x -->',
      'after',
    ].join('\n');

    const result = replaceMarkers(content, 'x', 'new');
    expect(result).toContain('before');
    expect(result).toContain('after');
  });

  it('handles multiple different markers', () => {
    const content = [
      '<!-- AUTO:a -->',
      'old-a',
      '<!-- /AUTO:a -->',
      'middle',
      '<!-- AUTO:b -->',
      'old-b',
      '<!-- /AUTO:b -->',
    ].join('\n');

    let result = replaceMarkers(content, 'a', 'new-a');
    result = replaceMarkers(result, 'b', 'new-b');
    expect(result).toContain('new-a');
    expect(result).toContain('new-b');
    expect(result).not.toContain('old-a');
    expect(result).not.toContain('old-b');
    expect(result).toContain('middle');
  });

  it('returns content unchanged if marker not found', () => {
    const content = '# No markers here\nJust text.';
    const result = replaceMarkers(content, 'missing', 'new stuff');
    expect(result).toBe(content);
  });

  it('handles empty new content', () => {
    const content = [
      '<!-- AUTO:x -->',
      'old',
      '<!-- /AUTO:x -->',
    ].join('\n');

    const result = replaceMarkers(content, 'x', '');
    expect(result).toContain('<!-- AUTO:x -->');
    expect(result).toContain('<!-- /AUTO:x -->');
    expect(result).not.toContain('old');
  });
});

// ---------------------------------------------------------------------------
// validateCrossLinks
// ---------------------------------------------------------------------------
describe('validateCrossLinks', () => {
  it('returns no errors for valid links', () => {
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Hi');
    fs.writeFileSync(path.join(tmpDir, 'other.js'), '');
    const md = '[readme](README.md) and [code](other.js)';
    const errors = validateCrossLinks(md, tmpDir);
    expect(errors).toHaveLength(0);
  });

  it('reports broken links', () => {
    const md = '[missing](does-not-exist.md)';
    const errors = validateCrossLinks(md, tmpDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('does-not-exist.md');
  });

  it('skips http/https URLs', () => {
    const md = '[site](https://example.com) and [api](http://api.dev)';
    const errors = validateCrossLinks(md, tmpDir);
    expect(errors).toHaveLength(0);
  });

  it('skips anchor-only links', () => {
    const md = '[section](#some-heading)';
    const errors = validateCrossLinks(md, tmpDir);
    expect(errors).toHaveLength(0);
  });

  it('handles links with subdirectory paths', () => {
    const docsDir = path.join(tmpDir, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'guide.md'), '');
    const md = '[guide](docs/guide.md)';
    const errors = validateCrossLinks(md, tmpDir);
    expect(errors).toHaveLength(0);
  });

  it('strips anchor from file paths before checking', () => {
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Hi');
    const md = '[section](README.md#installation)';
    const errors = validateCrossLinks(md, tmpDir);
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildDocsIndex
// ---------------------------------------------------------------------------
describe('buildDocsIndex', () => {
  it('indexes files at docs/ root', () => {
    const docsDir = path.join(tmpDir, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'getting-started.md'), '# Getting Started');
    fs.writeFileSync(path.join(docsDir, 'api-reference.md'), '# API Reference');

    const index = buildDocsIndex(tmpDir);
    expect(index).toContain('getting-started.md');
    expect(index).toContain('api-reference.md');
  });

  it('indexes files in subdirectories with section headings', () => {
    const plansDir = path.join(tmpDir, 'docs', 'plans');
    const decisionsDir = path.join(tmpDir, 'docs', 'decisions');
    fs.mkdirSync(plansDir, { recursive: true });
    fs.mkdirSync(decisionsDir, { recursive: true });
    fs.writeFileSync(path.join(plansDir, 'roadmap.md'), '# Roadmap');
    fs.writeFileSync(path.join(decisionsDir, '001-auth.md'), '# Auth Decision');

    const index = buildDocsIndex(tmpDir);
    expect(index).toContain('plans');
    expect(index).toContain('decisions');
    expect(index).toContain('roadmap.md');
    expect(index).toContain('001-auth.md');
  });

  it('indexes nested subdirectories', () => {
    const archiveDir = path.join(tmpDir, 'docs', 'archive', 'plans');
    fs.mkdirSync(archiveDir, { recursive: true });
    fs.writeFileSync(path.join(archiveDir, 'old-plan.md'), '# Old');

    const index = buildDocsIndex(tmpDir);
    expect(index).toContain('old-plan.md');
    expect(index).toContain('archive/plans');
  });

  it('extracts first heading as description', () => {
    const docsDir = path.join(tmpDir, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'setup.md'), '# Setting Up Your Environment\n\nDetails...');

    const index = buildDocsIndex(tmpDir);
    expect(index).toContain('Setting Up Your Environment');
  });

  it('returns empty message when docs/ does not exist', () => {
    const index = buildDocsIndex(tmpDir);
    expect(index).toMatch(/no doc/i);
  });

  it('returns empty message when docs/ is empty', () => {
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
    const index = buildDocsIndex(tmpDir);
    expect(index).toMatch(/no doc/i);
  });

  it('skips non-markdown files', () => {
    const docsDir = path.join(tmpDir, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'notes.md'), '# Notes');
    fs.writeFileSync(path.join(docsDir, 'diagram.png'), 'binary');
    fs.writeFileSync(path.join(docsDir, 'data.json'), '{}');

    const index = buildDocsIndex(tmpDir);
    expect(index).toContain('notes.md');
    expect(index).not.toContain('diagram.png');
    expect(index).not.toContain('data.json');
  });

  it('skips index.md itself', () => {
    const docsDir = path.join(tmpDir, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'index.md'), '# Index');
    fs.writeFileSync(path.join(docsDir, 'guide.md'), '# Guide');

    const index = buildDocsIndex(tmpDir);
    expect(index).toContain('guide.md');
    expect(index).not.toMatch(/\[index\.md\]/);
  });
});

// ---------------------------------------------------------------------------
// checkMarkersAreCurrent
// ---------------------------------------------------------------------------
describe('checkMarkersAreCurrent', () => {
  it('returns empty array when markers match', () => {
    const doc = [
      '<!-- AUTO:tree -->',
      'current tree',
      '<!-- /AUTO:tree -->',
    ].join('\n');
    const generated = { tree: 'current tree' };
    const stale = checkMarkersAreCurrent(doc, generated);
    expect(stale).toHaveLength(0);
  });

  it('reports stale markers', () => {
    const doc = [
      '<!-- AUTO:tree -->',
      'old tree',
      '<!-- /AUTO:tree -->',
    ].join('\n');
    const generated = { tree: 'new tree' };
    const stale = checkMarkersAreCurrent(doc, generated);
    expect(stale).toContain('tree');
  });

  it('checks multiple markers', () => {
    const doc = [
      '<!-- AUTO:tree -->',
      'ok tree',
      '<!-- /AUTO:tree -->',
      '<!-- AUTO:modules -->',
      'stale modules',
      '<!-- /AUTO:modules -->',
    ].join('\n');
    const generated = { tree: 'ok tree', modules: 'new modules' };
    const stale = checkMarkersAreCurrent(doc, generated);
    expect(stale).toContain('modules');
    expect(stale).not.toContain('tree');
  });

  it('reports marker as stale if not found in doc', () => {
    const doc = '# No markers';
    const generated = { tree: 'some content' };
    const stale = checkMarkersAreCurrent(doc, generated);
    expect(stale).toContain('tree');
  });
});
