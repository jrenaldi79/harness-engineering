# scripts/

Internal scripts for maintaining the harness-engineering repo itself. These are **not** shipped to users.

- `hooks/pre-commit` — Pre-commit hook: secret scanning + 300-line file size check
- `hooks/pre-push` — Pre-push hook: file size re-check + SHA-based test caching
- `install-hooks.sh` — Copies hooks into `.git/hooks/` and makes them executable

## Not to be confused with

`skills/setup/scripts/` — Enforcement scripts that `/setup` installs into **user projects**. Those are templates; these are for us.
