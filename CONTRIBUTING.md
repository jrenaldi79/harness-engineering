# Contributing to Harness Engineering

Thank you for your interest in contributing. This guide covers what you need to get started.

## Getting Started

1. Fork the repo and clone your fork
2. Create a feature branch: `git checkout -b my-feature`
3. Make your changes
4. Run tests: `node --experimental-vm-modules node_modules/.bin/jest tests/scripts/`
5. Commit with a clear message
6. Push and open a pull request against `main`

## What to Contribute

**Good first contributions:**
- Typo fixes and documentation improvements
- New entries in the best practices mapping table (with sources)
- Bug fixes in enforcement scripts
- Additional eval fixtures at different maturity levels

**Larger contributions (open an issue first):**
- New enforcement scripts
- Changes to SKILL.md skill logic
- New template files or rule files
- Structural changes to the plugin

## Project Structure

- `skills/readiness/` and `skills/setup/` contain the two plugin skills
- `skills/setup/scripts/` contains enforcement scripts that get installed into user projects
- `skills/setup/templates/` contains config file templates
- `tests/scripts/` contains unit tests (Jest)
- `tests/evals/` contains end-to-end evaluation fixtures

## Code Standards

- Enforcement scripts must work standalone with zero external dependencies (Node.js built-ins only)
- Scripts must be cross-platform (macOS, Linux, Windows)
- Keep files under 300 lines (we enforce this in the projects we set up, so we follow it ourselves)
- Write tests for new scripts in `tests/scripts/`

## Testing

### Unit Tests
```bash
node --experimental-vm-modules node_modules/.bin/jest tests/scripts/
```

### End-to-End Evals
```bash
bash tests/evals/run-evals.sh
```

The eval suite runs `/readiness` against three fixture projects (level-1-bare, level-3-enforced, level-5-autonomous) and validates the output with `grader.js`.

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include a clear description of what changed and why
- Add tests if you're adding or modifying scripts
- Update the README if you're adding new features or changing behavior
- Update CLAUDE.md if you're adding, removing, or renaming files in `skills/` or `tests/`

## Reporting Issues

Use [GitHub Issues](https://github.com/jrenaldi79/harness-engineering/issues). Include:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Node version, Claude Code version)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
