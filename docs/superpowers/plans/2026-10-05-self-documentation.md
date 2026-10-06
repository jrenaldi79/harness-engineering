---
title: "Self-documentation implementation plan"
description: "Task breakdown and verification requirements for the standalone documentation capability."
type: "history"
status: "completed"
read_when: "Tracing the implementation and verification of the documentation capability."
---
# Self-documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Independently installable, deterministic self-documentation capability reused by the full harness.

**Architecture:** Self-contained documentation skill holds a dependency-free Node engine, installer and metadata reference. Target projects receive portable scripts; staged validation operates on a virtual Git-index filesystem. The full setup shares the canonical implementation.

**Tech Stack:** Node.js 18+, CommonJS, built-in node:test/assert, Git CLI.

## Global Constraints

Follow the approved contract in `docs/superpowers/specs/2026-10-05-self-documentation-design.md`. No machine configuration changes, secrets or vendor requests. No auto-staging. Source scanning reads filenames only. No symlink/junction traversal. Keep source files under 300 lines. Working checkout is isolated on `codex/standalone-documentation`.

### Task 1: Canonical generator and staged snapshot

**Files:** create `plugins/documentation/skills/documentation/scripts/{generate,filesystem,metadata,render}.js` and `tests/documentation/engine.test.js`.

**Interfaces:** `generate.js` exports `generate(root, options)` and runs CLI `--root=<path> [--check] [--staged] [--strict]`; library returns `{outputs, missing}` where outputs maps relative path to content. `filesystem.js` provides working-tree and staged-index bounded readers. `metadata.js` owns flat-frontmatter/catalog validation. `render.js` owns strict marker replacement and generated table/index rendering.

- [x] Write engine tests before implementation, including the first desired assertion:

```js
const {generate} = require('../../plugins/documentation/skills/documentation/scripts/generate');
assert.equal(typeof generate, 'function');
```

- [x] Run `node --test tests/documentation/engine.test.js`; verify failure because the engine is absent, then implement the contract.
- [x] Cover fresh config, metadata errors, scanner containment, new/deleted/renamed docs, byte-preserving marker output and check/staged behavior with real synthetic Git repositories.
- [x] Run the same test command until passing; self-review exact staged reads and write ownership.
- [x] Commit only Task 1 source/tests after review; never stage other worker changes.

### Task 2: Safe installation and explicit migration

**Files:** create `plugins/documentation/skills/documentation/scripts/{install,migrate,install-hook}.js` and `tests/documentation/install.test.js`.

**Interfaces:** installer exports `install(target, options)`; CLI `--target=<path> [--instruction=CLAUDE.md|AGENTS.md] [--sources=src,lib] [--docs=docs] [--adopt-index] [--hook]`. Installer writes configuration/ownership records and appends marker instructions without rewriting prose. Migration CLI `--root=<path> [--write]`. Hook helper exports `installHook(root)` and CLI `--root=<path>`.

- [x] Add failing tests for isolated copy installation, existing handwritten index refusal, safe legacy adoption, repeat install, modified scripts/upgrade refusal, no config edits and hook preservation.
- [x] Run `node --test tests/documentation/install.test.js` to confirm missing behavior.
- [x] Implement ownership-hash preflight and idempotent copying; preserve configuration and authored instructions. All checks precede mutations.
- [x] Test migration preview/no mutation, safe quoted Unicode metadata, matching catalog removal and conflicts.
- [x] Run `node --test tests/documentation/*.test.js`; review and commit Task 2 only.

### Task 3: Marketplace and full-harness integration

**Files:** create documentation manifest, SKILL.md, reference, README, agents/openai.yaml; modify marketplace/README/CLAUDE/CHANGELOG/setup skill/installer/hook templates. Create integration tests.

**Interfaces:** full setup calls the canonical installer from the root plugin checkout. It places a compatibility launcher at `scripts/generate-docs.js` that delegates to `scripts/self-documentation/generate.js`. New full-suite commits use `node scripts/self-documentation/generate.js --staged`; standalone package has no full-harness dependency.

- [x] Add failing tests proving separate marketplace entry, extracted-plugin and extracted-skill independence and full `/setup` delegation.
- [x] Document exact install/refresh/check/staged/migration commands and metadata grammar, with truthful limits on prose generation.
- [x] Replace target-facing old generator installation with canonical installer delegation; keep legacy exported helper APIs for repository tests where needed, without installing a second generator.
- [x] Run new tests plus relevant existing setup/generator/marketplace tests. Regenerate repository instruction markers without auto-staging.
- [x] Final independent spec/code review, address findings, verify branch and prepare a reviewable draft PR if publication is authorized; otherwise retain local tested branch.
