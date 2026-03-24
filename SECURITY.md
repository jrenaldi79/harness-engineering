# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do not open a public issue.** Instead, email the maintainers directly (see the repository contact information) with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

You should receive a response within 48 hours. We will work with you to understand the issue and coordinate a fix before any public disclosure.

## Scope

This project includes secret-scanning patterns (`check-secrets.js`) and security-related enforcement scripts. Security reports related to these components are especially welcome:

- False negatives in secret detection patterns (secrets that should be caught but aren't)
- Bypass techniques for enforcement scripts
- Issues in template files that could introduce vulnerabilities into user projects

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |

## Security Features

This project provides security tooling for other projects:

- **Secret scanning**: `check-secrets.js` pattern-matches API keys, tokens, and private keys in staged files
- **File size limits**: `check-file-sizes.js` prevents large files that are harder to review for security issues
- **Permission defaults**: `settings.json` template blocks dangerous commands (`rm -rf /`, `git push --force`, `npm publish`)

These are defense-in-depth measures. They catch common mistakes but are not a substitute for a full security review.
