# Testbench Setup And Run Guide

This document explains how to run and validate the Sentinel demo environment in `testbench/`.

## 1. What Is Included

`testbench/` contains:

- `blog/`: React mini-blog demo project
- `blog/database/posts/`: markdown post fixtures (timeline from 2010 to 2026)
- `sentinel/`: Python safeguard logic (`mcp_server.py`, `git_skill.py`)
- `scripts/test_cases.md`: user prompts + expected behavior definitions
- `scripts/ui_test_resources.json`: test resources consumed by the web app Test page
- `scripts/test_sentinel.py`: pytest automation for 3 critical scenarios
- `scripts/requirements-dev.txt`: Python dev dependency list (`pytest`)
- `scripts/bootstrap_testbench.sh`: quick script to ensure folder structure exists

## 2. Prerequisites

- Node.js 18+
- npm
- Python 3.10+ (optional, only needed for pytest automation)

## 3. Project Root Setup

From repository root:

```bash
cd /Users/cirnovsky/repos/dlweek/TheSentinel
npm install
```

## 4. Run The Main Sentinel Web App

```bash
npm run dev
```

Open:

- `http://localhost:3000`

### Use The Test Page (No Python Required)

1. In the app header, click `Test`.
2. On the Test page, run each scenario button:
   - `Data Wipe`
   - `Environment Setup Wipe`
   - `Exposure of Secrets`
3. For each run, verify:
   - `User Prompt` display
   - `Expected Behavior` display
   - `Actual JSON Report`
   - `PASS` status shown by the UI

The Test page loads scenario resources from:

- `testbench/scripts/ui_test_resources.json`

## 5. Run The Mini-Blog Demo Directly (Optional)

```bash
cd /Users/cirnovsky/repos/dlweek/TheSentinel/testbench/blog
npm install
npm run dev
```

Open:

- `http://localhost:4173`

## 6. Run Python Safeguard Tests (Optional)

From repository root:

```bash
python3 -m pip install -r testbench/scripts/requirements-dev.txt
python3 -m pytest -q testbench/scripts/test_sentinel.py
```

What these tests validate:

1. Data wipe commands are marked `CRITICAL` and blocked.
2. Environment wipe commands (`venv`, `.git`, `node_modules`) are marked `CRITICAL` with `rollback_available: false`.
3. Secret exposure in `config.py`/`.env` is blocked by Git safety checks and not staged.

## 7. Key Files To Review

- `testbench/sentinel/mcp_server.py`
- `testbench/sentinel/git_skill.py`
- `testbench/scripts/test_sentinel.py`
- `testbench/scripts/test_cases.md`
- `testbench/scripts/ui_test_resources.json`
- `src/components/TestPage.tsx`

## 8. Quick Troubleshooting

- If `npm run dev` fails: run `npm install` again at repo root.
- If port `3000` is busy:
  ```bash
  npm run dev -- --port 5173
  ```
- If `pytest` is missing:
  ```bash
  python3 -m pip install -r testbench/scripts/requirements-dev.txt
  ```

## 9. Expected Demo Outcome

Judges can evaluate all three Sentinel safety scenarios directly in the web app Test page without setting up Python.
Python tests remain available as an additional backend verification path.
