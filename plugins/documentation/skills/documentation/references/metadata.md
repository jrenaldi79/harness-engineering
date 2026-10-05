# Document metadata and lifecycle

Each classified document has five one-line string fields:

```markdown
---
title: "Architecture"
description: "Component boundaries and dependency directions."
type: "guidance"
status: "maintained"
read_when: "Changing a component boundary or adding an integration."
---

# Architecture

Authored documentation follows here.
```

This is a deliberately bounded flat YAML subset, not a general YAML parser.
Use JSON-quoted string values (including Unicode) or simple unquoted strings.
Arrays, nesting, multiline values, anchors, aliases, duplicate/unknown fields and
empty strings are rejected. Keep frontmatter within the first 16 KiB. Prefer
quoted strings when punctuation could be interpreted as YAML syntax.

| Type | Use for |
| --- | --- |
| guidance | Current architecture, operations and development instructions |
| status | Progress, review results and current limitations |
| reference | Supporting technical references and attachments |
| proposal | Changes being considered or awaiting adoption |
| generated | Deterministic inventories and generated references |
| history | Completed, abandoned or superseded records |
| temporary | Working notes awaiting promotion or deliberate removal |

Statuses: `maintained`, `snapshot`, `pending`, `completed`, `abandoned`,
`superseded`, `temporary`, `generated`.

Metadata describes purpose and lifecycle. It does not grant permission to execute
commands or make a proposal authoritative. Applicable project instructions and
explicit user authorization continue to govern actions.

## Catalog fallback

Projects with an existing tree/module generator can set optional configuration
`"managedMarkers": ["docs"]`. This engine preserves those other generated regions
and replaces only AUTO:docs. The default remains docs/tree/modules; every marker
must still be balanced, unnested across managed regions, and well formed.

`<docsRoot>/catalog.json` is an object keyed by document paths relative to the
documentation root, using `/` separators. Records use the same five fields.
Attachment contents are never read by the indexer:

```json
{
  "vendor/overview.pdf": {
    "title": "Vendor overview",
    "description": "Reviewed supporting reference.",
    "type": "reference",
    "status": "snapshot",
    "read_when": "Checking the documented vendor contract."
  }
}
```

Markdown frontmatter takes precedence when present. A duplicate catalog record
must agree exactly; conflicting records fail validation. Markdown without
frontmatter uses catalog metadata. Missing metadata is listed under Needs
classification. Refresh and check allow it by default; `--strict` rejects it.
Invalid metadata always fails, even in non-strict mode.

For compatibility, an exact legacy record with `title`, `type`, `status`, `note`
is accepted. Its note becomes description; its read_when becomes
"When working with this document." Improve that generic cue during migration.
Mixed legacy/new fields are rejected.

## Explicit migration

Run `node scripts/self-documentation/migrate.js` to preview conversion of catalog
records for Markdown into frontmatter. `--write` applies the conversion and removes
those catalog entries only after validation. Attachments stay in the catalog.
Existing bodies and existing matching frontmatter remain intact. Conflicts stop
the operation; refresh never silently migrates metadata.

## Configuration and scope

`documentation.config.json` declares version 1, sourceRoots, docsRoot, instruction,
index and strict. Defaults use source roots src/lib/app/scripts, docsRoot `docs`,
instruction `CLAUDE.md`, index `docs/index.md`, strict false. A project need not use
Node for its application; Node 18+ is the documentation tooling runtime.

Roots are explicit, relative, disjoint and contained in the project. Hidden,
private, secrets, runs, outputs, fixtures, dependency/cache/build paths are
excluded. Linked paths and non-regular staged entries are rejected. Do not add
client-data directories to source roots. Source files are inventoried by filename;
the generator neither imports modules nor reads their source contents.

The index is generated and owned by the capability. Handwritten instruction
content outside AUTO markers stays unchanged. Full documentation correctness
still requires maintaining authored descriptions, read_when cues and prose.
