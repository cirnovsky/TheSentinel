# Testbench Setup And Run Guide

This document explains how to run and validate the Sentinel demo environment in `testbench/`.

## 1. What Is Included

`testbench/` contains:

- `blog/`: React mini-blog demo project
- `blog/database/posts/`: markdown post fixtures (timeline from 2010 to 2026)
- `sentinel/`: Python safeguard logic (`mcp_server.py`, `git_skill.py`)
- `scripts/test_cases.md`: user prompts + expected behavior definitions
- `scripts/ui_test_resources.json`: test resources consumed by the web app Test page
- `scripts/bootstrap_testbench.sh`: quick script to ensure folder structure exists

## 2. Prerequisites

- Node.js 18+
- npm

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

## 5. Golden Path: Interactive Sandbox Evaluation

Use the in-app Interactive Sandbox (`Test` page). No custom scripts are needed.

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

## 6. Run The Mini-Blog Demo Directly (Optional)

```bash
cd /Users/cirnovsky/repos/dlweek/TheSentinel/testbench/blog
npm install
npm run dev
```

Open:

- `http://localhost:4173`

## 7. Key Files To Review

- `testbench/sentinel/mcp_server.py`
- `testbench/sentinel/git_skill.py`
- `testbench/scripts/test_cases.md`
- `testbench/scripts/ui_test_resources.json`
- `src/components/TestPage.tsx`

## 8. Quick Troubleshooting

- If `npm run dev` fails: run `npm install` again at repo root.
- If port `3000` is busy:
  ```bash
  npm run dev -- --port 5173
  ```

## 9. Expected Demo Outcome

Judges can evaluate all Sentinel safety scenarios directly in the web app Test page without Python setup.
