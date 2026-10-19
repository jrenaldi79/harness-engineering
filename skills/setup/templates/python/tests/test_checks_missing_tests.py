"""TDD gate: newly added modules must arrive with a matching test."""

from scripts.checks.missing_tests import expected_test, find_missing

RULES = [
    {"dir": "src/app/hosted", "pattern": "tests/test_hosted_{stem}*.py"},
    {"dir": "src", "pattern": "tests/*test_{stem}*.py"},
]


def test_first_matching_rule_wins():
    assert expected_test("src/app/hosted/uploads.py", RULES) == "tests/test_hosted_uploads*.py"
    assert expected_test("src/app/core.py", RULES) == "tests/*test_core*.py"


def test_parent_placeholder():
    rules = [{"dir": "pkg", "pattern": "tests/{parent}/test_{stem}.py"}]
    assert expected_test("pkg/io/reader.py", rules) == "tests/io/test_reader.py"


def test_exempt_paths_have_no_expectation():
    for path in ["src/app/__init__.py", "src/app/__main__.py", "scripts/tool.py",
                 "tests/helpers.py", "src/app/data.json", "srcx/app/core.py"]:
        assert expected_test(path, RULES) is None, path


def test_nested_and_topic_tests_satisfy_the_mapping():
    existing = ["tests/unit/test_core.py", "tests/test_hosted_uploads_limits.py"]
    assert find_missing(["src/app/core.py", "src/app/hosted/uploads.py"], existing, RULES) == []


def test_reports_each_new_module_without_a_test():
    assert find_missing(["src/app/feature.py", "src/app/hosted/limits.py"], ["tests/test_limits.py"], RULES) == [
        ("src/app/feature.py", "tests/*test_feature*.py"),
        ("src/app/hosted/limits.py", "tests/test_hosted_limits*.py"),
    ]


def test_a_test_added_in_the_same_commit_counts():
    assert find_missing(["src/app/feature.py", "tests/test_feature.py"], [], RULES) == []
