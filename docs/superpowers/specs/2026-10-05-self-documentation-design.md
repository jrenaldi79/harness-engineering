---
title: "Standalone self-documentation design"
description: "Approved boundaries and behavior for the independently installable documentation capability."
type: "proposal"
status: "maintained"
read_when: "Reviewing the documentation engine or installer contract."
---
# Standalone self-documentation capability

Approved direction: a separately installable documentation plugin in the existing
harness-engineering marketplace. Student sandboxes are outside this feature.

## Contract

Installation compatibility: optional `managedMarkers` selects owned AUTO blocks
(docs is required). Absent means docs/tree/modules. Existing specialized module
generators can retain tree/modules ownership while this engine owns docs only.

- Canonical implementation lives under `plugins/documentation/skills/documentation/`.
  It is a self-contained skill: its scripts and references travel with the skill.
- Node.js 18+ and Git for staged validation; no runtime npm dependencies.
- Full `/setup` installs this implementation; it must not install a competing
  documentation generator. Compatibility helpers for existing API tests may remain
  in the full plugin, but the target project has one generator.
- Target scripts live in `scripts/self-documentation/`. Configuration is
  `documentation.config.json`; install ownership/version/hashes are recorded in
  `scripts/self-documentation/installed.json`. Neither global settings nor Claude/
  Codex permission configuration is edited by this capability.
- Default output is `docs/index.md`, preserving existing harness link conventions.
  A compact `AUTO:docs` block in the selected instruction file links to the index.
  Existing `AUTO:tree` and `AUTO:modules` blocks are maintained when present.
  Authored text outside markers must remain byte-for-byte unchanged.
- Inventory source filenames under explicit configured source roots. Do not import
  modules or read source payloads; module purposes remain authored documentation.
- Scan only explicit source/doc roots, skipping hidden paths, private, secrets,
  runs, outputs, fixtures, node_modules, caches, builds, and filesystem links.
  Validate path containment, root/output overlap and link-free parent chains.
- Markdown frontmatter: a bounded flat YAML subset, keys title, description, type,
  status, read_when; every field is a one-line string (JSON-quoted strings allowed).
  Types: guidance/status/reference/proposal/generated/history/temporary.
  Statuses: maintained/snapshot/pending/completed/abandoned/superseded/temporary/generated.
  Catalog JSON maps doc-relative paths to this metadata. It covers attachments and
  Markdown without frontmatter. Conflicting duplicate records fail; unknown fields
  and malformed frontmatter fail. Attachment contents are never read.
- Missing metadata is visible under Needs classification. Refresh/check permit
  missing metadata by default; `--strict` rejects it. Invalid metadata always fails.
  Refresh never rewrites authored frontmatter. Explicit migration previews changes
  unless `--write` is specified; removes migrated catalog entries only after success.
- Refresh updates only owned/generated outputs, validates all inputs before writing,
  never invokes `git add`. Check is read-only and compares all outputs.
- `--staged` builds a virtual filesystem from the Git index and validates that exact
  snapshot. It never writes files or reads working-tree inputs. Non-regular Git
  modes and unresolved entries are rejected in relevant scope.
- Optional Git hook installation preserves existing hooks/core.hooksPath: create a
  hook only for a default, empty hook location; otherwise print the integration
  command. No automatic editor lifecycle hooks, watchers, or CI installation.
- Installation/reinstallation/upgrades preserve authored instructions, configuration
  and existing hook behavior; detect locally modified owned scripts via recorded
  hashes and fail before mutation. Explicit adoption is needed for an existing
  handwritten index. Generated legacy harness indexes can be adopted safely.

## Verification

Use synthetic fixtures only. Test metadata/frontmatter conflicts and migration,
determinism, add/delete/rename discovery, byte preservation, malformed markers,
safe roots and linked paths, attachment non-reading, isolated skill/plugin copy,
reinstall/upgrade refusal, Windows spaces/Unicode, read-only checks and staged
snapshot divergence including partial staging and deletion.
