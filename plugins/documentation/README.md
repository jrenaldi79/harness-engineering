# Self-documentation plugin

Independently installable documentation indexing and maintenance for any stack.
Node.js 18+ is required for tooling; Git is needed only for staged checks/hooks.
No npm runtime dependencies. No editor hooks, watchers or settings changes.

## Install only this capability

In Claude Code, after the marketplace update is published:

```text
/plugin marketplace add jrenaldi79/harness-engineering
/plugin install documentation@harness-engineering
/documentation:documentation
```

For local development, load this directory with Claude Code's `--plugin-dir`.
The complete `skills/documentation/` folder can also be installed as a standalone
skill in a coding client's supported skill directory; retain scripts, references
and agents alongside SKILL.md. Do not copy just the prompt.

The full harness `/setup` calls the same bundled installer. This package does not
require `/setup`, readiness analysis, Husky, application dependencies or the full
harness to function.

## Apply to a project

Resolve the directory containing the loaded skill's SKILL.md and run:

```text
node "<skill-directory>/scripts/install.js" --target="<project-root>"
```

Use `--instruction=AGENTS.md`, `--sources=src,lib` or `--docs=docs` when appropriate.
Existing configuration wins on repeat installation. Optional `--hook` installs
only into an empty default hook location; existing hooks/custom hooksPath are
preserved and receive a printed integration command. A handwritten index requires
explicit `--adopt-index` after its prose has been preserved elsewhere.

When another generator owns an existing tree or module block, set
`"managedMarkers": ["docs"]` in `documentation.config.json` before installation.
The new engine then preserves those blocks and owns only the document reading map.
Omitting this option keeps the default ownership of docs, tree and modules.

Installer-owned scripts live under `scripts/self-documentation/`. Installed
version and file hashes protect locally modified scripts during reinstall/upgrade.
Project commands work without the plugin checkout or cache:

```text
node scripts/self-documentation/generate.js          # Refresh inventory/index
node scripts/self-documentation/generate.js --check  # Read-only working-tree check
node scripts/self-documentation/generate.js --staged # Read-only Git index check
node scripts/self-documentation/generate.js --check --strict
node scripts/self-documentation/migrate.js            # Preview metadata migration
node scripts/self-documentation/migrate.js --write
```

For a commit, refresh, review and stage the intended inputs and generated outputs,
then run `--staged`. Partial staging is supported: the staged check reads that
snapshot, so unrelated working-tree edits cannot change its result. Nothing is
automatically staged.

## Progressive disclosure

CLAUDE.md or AGENTS.md links to the generated `docs/index.md`. Each document entry
has a description, lifecycle status and a concrete read_when cue. Guidance and
status come before proposals, history and temporary notes. New, renamed and deleted
files are discovered on each run; uncategorized files stay visible.

See [the metadata contract](skills/documentation/references/metadata.md) for the
flat frontmatter format, catalog fallback, conflict handling and migration.

The generator maintains indexes and filename inventories. Agents maintain
substantive documentation alongside implementation changes. Passing a check
establishes structural freshness, not semantic correctness of authored prose.
