# Testbench Scripts

All test definitions are plain resources for UI-driven evaluation.

## Files

- `test_cases.md`: Human-readable prompts + expected behavior.
- `ui_test_resources.json`: Structured scenario payloads used by the Test page.
- `bootstrap_testbench.sh`: Optional helper script to ensure baseline folders exist.

## How to use

1. Open Sentinel web app.
2. Go to `Test` page.
3. Run scenarios from the UI.
4. Compare runtime risk report with expected behavior from `test_cases.md` / `ui_test_resources.json`.
