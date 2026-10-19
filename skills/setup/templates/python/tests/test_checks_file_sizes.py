"""File-size gate: `cap` blocks any staged file over the limit; `ratchet` lets oversized files shrink."""

from scripts.checks.config import DEFAULTS
from scripts.checks.file_sizes import count_lines, is_checked, violations

PATH = "src/app/m.py"


def lines(n):
    return "x\n" * n


def check(new, old=None, **overrides):
    return violations([PATH], {PATH: new}.get, {PATH: old}.get, {**DEFAULTS, **overrides})


def test_defaults():
    assert DEFAULTS["limit"] == 300
    assert DEFAULTS["sizePolicy"] == "ratchet"


def test_new_file_over_limit_is_blocked():
    assert check(lines(301)) == [(PATH, 301, None)]
    assert check(lines(300)) == []


def test_ratchet_blocks_crossing_and_growth_only():
    assert check(lines(310), lines(290)) == [(PATH, 310, 290)]
    assert check(lines(716), lines(716)) == []
    assert check(lines(700), lines(716)) == []
    assert check(lines(720), lines(716)) == [(PATH, 720, 716)]


def test_cap_blocks_every_oversized_file():
    assert check(lines(700), lines(716), sizePolicy="cap") == [(PATH, 700, 716)]


def test_limit_is_configurable():
    assert check(lines(350), limit=400) == []


def test_trailing_line_without_newline_counts():
    assert count_lines(lines(300) + "tail") == 301
    assert count_lines("") == 0


def test_code_files_are_checked_unless_skipped():
    config = {**DEFAULTS, "sizeSkip": ["vendor/", "src/app/generated/"]}
    for path in ["src/app/server.py", "tests/test_server.py", "scripts/run.sh", "web/app.ts"]:
        assert is_checked(path, config), path
    for path in ["vendor/lib.py", "src/app/generated/schema.py", "uv.lock", "README.md", "data.json"]:
        assert not is_checked(path, config), path


def test_unreadable_new_content_is_skipped():
    assert violations([PATH], lambda _p: None, lambda _p: None, DEFAULTS) == []
