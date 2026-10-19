"""Pre-commit secret scan. Secret-shaped fixtures are built at runtime, never written as literals."""

import base64

from scripts.checks.secret_scan import (
    build_patterns,
    is_skipped,
    scan_content,
    scan_files,
)

VARIED = "Q7xk2Lp9Rm4Tz8Vb1Nc6Hd3Jf5Gs0Wa"  # many distinct characters, like a real key


def names(content, path="src/app/x.py", patterns=None):
    found = scan_content(content, path) if patterns is None else scan_content(content, path, patterns)
    return [f.pattern for f in found]


def test_provider_keys_are_caught():
    assert names("sk-or-" + "v1-" + "a1" * 32) == ["OpenRouter API key"]
    assert names("sk-ant-" + "api03-" + "b" * 30) == ["Anthropic API key"]
    assert names("sk-" + "proj-" + VARIED * 2) == ["OpenAI API key"]
    assert names("AKIA" + "Q7XK2LP9RM4TZ8VB") == ["AWS access key"]
    assert names("ghp_" + VARIED + "abcd") == ["GitHub token"]
    assert names("xoxb-" + "1234-" + VARIED) == ["Slack token"]
    assert names("AIza" + VARIED + "abcd") == ["Google API key"]
    assert names("sk_" + "live_" + VARIED) == ["Stripe live key"]
    assert names("-----BEGIN " + "RSA PRIVATE KEY-----") == ["Private key block"]


def test_jwt_literals_are_caught_even_in_tests():
    jwt = "eyJ" + "hbGciOiJIUzI1NiJ9" + ".eyJ" + "zdWIiOiJhbGljZSJ9" + "." + "S" * 20
    assert names(jwt, "tests/test_auth.py") == ["JWT"]


def test_short_or_repeated_synthetic_values_pass():
    assert names('key = "' + "sk-or-" + 'v1-alice"') == []
    assert names('API_TOKEN = "' + "k" * 32 + '"') == []
    assert names('API_KEY_ENV = "OPENROUTER_API_KEY"') == []


def test_credential_assignments_with_real_looking_values():
    assert names('DB_PASSWORD = "' + VARIED + '"') == ["Credential assignment"]
    assert names("client_secret: '" + VARIED + "'") == ["Credential assignment"]
    assert names("token = os.environ['API_TOKEN']") == []


def test_database_urls_flag_real_passwords_only():
    assert names("postgresql://app:" + VARIED + "@db.example.com/x") == ["Database URL with password"]
    assert names("mongodb+srv://u:" + VARIED + "@cluster0.example.net") == ["Database URL with password"]
    assert names("postgres://postgres:test@localhost:5432/postgres") == []
    assert names("postgresql://user:${PGPASSWORD}@db.example.com/x") == []
    assert names("postgresql://app@db.example.com/x") == []


def test_project_patterns_extend_the_defaults():
    patterns = build_patterns([{"name": "Vault key", "regex": r"v1:([A-Za-z0-9+/]{43}=)"}])
    key = "v1:" + base64.b64encode(bytes(range(1, 33))).decode()
    assert names(key, patterns=patterns) == ["Vault key"]
    assert names("v1:" + "A" * 43 + "=", patterns=patterns) == []


def test_findings_carry_location_but_never_the_value():
    (finding,) = scan_content("ok\n" + "AKIA" + "Q7XK2LP9RM4TZ8VB\n", "src/a.py")
    assert (finding.file, finding.line, finding.pattern) == ("src/a.py", 2, "AWS access key")
    assert "Q7XK" not in repr(finding)


def test_inline_pragma_allows_a_reviewed_line():
    assert names("AKIA" + "Q7XK2LP9RM4TZ8VB  # pragma: allowlist secret") == []


def test_lockfiles_and_configured_paths_are_skipped():
    skip = [r"(^|/)uv\.lock$", r"^vendor/"]
    assert is_skipped("uv.lock", skip)
    assert is_skipped("vendor/lib.py", skip)
    assert not is_skipped("tests/test_auth.py", skip)


def test_scan_files_skips_unreadable_and_skipped_paths():
    key = "AKIA" + "Q7XK2LP9RM4TZ8VB"
    files = {"a.py": key, "uv.lock": key, "gone.py": None}
    found = scan_files(list(files), files.get, [r"(^|/)uv\.lock$"])
    assert [f.file for f in found] == ["a.py"]
