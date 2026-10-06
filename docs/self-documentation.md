---
title: "Self-documentation development"
description: "Canonical engine, packaging boundaries and maintenance commands for this repository."
type: "guidance"
status: "maintained"
read_when: "Changing documentation generation, metadata, installation or full-harness integration."
---

# Self-documentation development

The canonical implementation is the self-contained skill at
`plugins/documentation/skills/documentation/`. The standalone documentation plugin
packages that skill. Full setup calls its installer from the encompassing root
plugin; copied target scripts never require the original plugin cache.

This repository uses the same engine through `scripts/repo-generate-docs.js` and
`documentation.config.json`. Refresh explicitly after adding, removing or renaming
files or changing document metadata:

```text
node scripts/repo-generate-docs.js
node scripts/repo-generate-docs.js --check
node scripts/repo-generate-docs.js --staged
```

Review and stage the intended inputs and generated outputs together. The staged
check reads the exact Git index; it never writes or stages files. Source files
are listed by filename, with full inventory in docs/index.md and compact root
counts in CLAUDE.md. Keep handwritten guidance and metadata current yourself.

The repository's pre-commit template performs staged documentation validation.
Existing installed hooks are not silently changed by this source update. The
documentation-only hook helper preserves existing hooks and custom hooksPath.

See [plugin usage](../plugins/documentation/README.md) and
[metadata grammar and migration](../plugins/documentation/skills/documentation/references/metadata.md).
Missing metadata stays visible; invalid or conflicting metadata blocks checks.
Refresh never rewrites frontmatter. Explicit migration previews changes before
`--write` applies them.

## Tests

```text
node --test tests/documentation/engine.test.js tests/documentation/install.test.js tests/documentation/integration.test.js
npx jest@30 --config '{}' tests/scripts/ --runInBand
```

Use synthetic temporary projects only. Tests must cover copied-plugin/skill
independence, input/output bounds, authored-text preservation, staged divergence,
metadata conflicts, installation ownership, migration, existing hooks and
Windows path/newline behavior. Run Node18+ CI on Windows and Linux; application
source languages do not change the documentation runtime requirement.
