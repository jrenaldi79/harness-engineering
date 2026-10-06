---
name: documentation
description: Use when the user asks to install or maintain a documentation index, keep CLAUDE.md or AGENTS.md inventories synchronized with files, add document metadata, classify documentation, or apply documentation-only setup to a repository.
---

# Project self-documentation

Keep instructions short: instruction file -> documentation index -> relevant document.
Use the deterministic scripts for discovery and validation; update explanatory prose
from the actual implementation and reviewed evidence.

## Locate resources and assess the project

Resolve this loaded SKILL.md's directory as `SKILL_DIR`. Its `scripts/` and
`references/` directories are self-contained siblings; do not search another
plugin's cache or assume a fixed user home, shell or install location.

Read the target project's applicable instructions first. Check Node.js is 18+
and inspect the existing documentation configuration, instruction markers and
hook arrangement. Choose explicit source roots and a documentation directory.
Source inventories read filenames only. Do not include sensitive/private data
paths or broaden an existing allowlist without reviewing its scope.

Read [metadata and lifecycle rules](references/metadata.md) when classifying or
creating documents, migrating a catalog, or resolving validation failures.

## Set up documentation only

Before the first installation, create `documentation.config.json` when a different
generator owns tree/module blocks or a handwritten index must remain intact:

```json
{
  "version": 1, "sourceRoots": ["src", "scripts"], "docsRoot": "docs",
  "instruction": "CLAUDE.md", "index": "docs/classified-index.md",
  "strict": false, "managedMarkers": ["docs"]
}
```

Use reviewed project roots. This example preserves the handwritten docs/index.md
and existing tree/module generator; new projects can use the installer defaults.

Run the bundled installer from the target project with absolute, quoted paths:

```text
node "<SKILL_DIR>/scripts/install.js" --target="<project-root>"
```

The default instruction file is CLAUDE.md. Select `--instruction=AGENTS.md` when
appropriate; set `--sources=src,lib,scripts` and `--docs=docs` to reviewed roots.
The installer preserves authored text and configuration, copies portable scripts
to `scripts/self-documentation/`, and generates the configured index. It does not
install package dependencies or edit Claude/Codex settings or permission files.

If an existing handwritten index conflicts, inspect it and agree on adoption
before using `--adopt-index`. Keep existing explanatory content elsewhere before
adopting an index that the generator will own. Do not use adoption to overwrite
an unrelated file. Modified owned scripts require a deliberate upgrade decision.

Git hooks are optional. After explicit hook adoption is within the user's scope,
run the installed hook helper; it preserves existing hooks and custom hooksPath,
printing the integration command when automatic installation is unsuitable.

```text
node scripts/self-documentation/install-hook.js
```

Installing this plugin or skill alone does not activate a filesystem watcher.
The installed scripts work after the plugin cache is removed.

If another generator owns existing tree or module blocks, use optional config
`managedMarkers: ["docs"]` to preserve them. Omit it for the default ownership
of docs, tree and modules. All AUTO markers still must be balanced and well formed.

## Maintain docs during development

When files or modules change, update the relevant handwritten documentation in
the same change. Explain behavior, commands, interfaces and gotchas that changed.
Do not treat a successful inventory check as proof that prose is correct.

For a new Markdown document, add all five metadata fields described in the
reference. Use catalog metadata for attachments without opening their contents.
Classify completed plans as history; proposals and temporary notes are not
operational authority. Never infer approvals from document lifecycle metadata.

```text
node scripts/self-documentation/generate.js
node scripts/self-documentation/generate.js --check
node scripts/self-documentation/generate.js --strict --check
```

Review generated changes and stage them with the intended inputs. The generator
never stages files. A staged check validates exactly the Git index, so unstaged
fixes cannot conceal an inconsistent commit:

```text
node scripts/self-documentation/generate.js --staged
```

Catalog-to-frontmatter migration is explicit. Preview first, review the affected
Markdown documents, then apply; normal refresh never rewrites authored metadata.

```text
node scripts/self-documentation/migrate.js
node scripts/self-documentation/migrate.js --write
```

## Verify and report

Run refresh and check after installation. When Git integration is selected, also
validate a staged snapshot containing the configuration, inputs and outputs.
Report created/updated files, unclassified documents, preserved-hook integration
steps and any runtime limitations. Keep temporary/historical material visibly
separate and read only the documents relevant to the current task.
