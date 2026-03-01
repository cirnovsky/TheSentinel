# The Sentinel

The Sentinel is a safe, human-governed AI coding agent that acts as a contributor rather than a dictator.

Project Demo Video: [Add video link here](https://example.com/demo)

## 1. The Hook & Innovations

- **Agent-as-Contributor:** The AI does not blindly overwrite files; it works in isolated branches and proposes atomic commits that humans can review before merge.
- **Git-Integrated Governance:** The app includes a visual Git tree so humans can inspect diffs, revert commits, check out history safely, and explicitly approve/reject AI branches.
- **Policy-as-Code Safety Wrapper:** Sentinel guardrails intercept risky actions (data wipes, environment wipes, secret leaks) before execution and require human approval for destructive operations.

## 2. Prerequisites & Environment Variables

### Required software

- `Git` (2.30+)
- `Node.js` (18+ recommended)
- `npm` (9+ recommended)
- `Python` (3.10+)
- Codex/OpenAI API access (`OPENAI_API_KEY`)

### Dependencies

- Frontend + app server dependencies are managed by `npm` via [`package.json`](/Users/cirnovsky/repos/dlweek/TheSentinel/package.json).
- Python safeguard API dependencies are managed by [`requirements.txt`](/Users/cirnovsky/repos/dlweek/TheSentinel/requirements.txt).

### Environment setup

Create a `.env.local` file in repository root:

```bash
cp .env.example .env.local
```

Set required values:

```env
OPENAI_API_KEY=your_api_key_here
# Optional model override:
OPENAI_MODEL=gpt-4.1
# Optional base URL override:
# OPENAI_BASE_URL=https://api.openai.com/v1
APP_URL=http://localhost:3000
```

Notes:
- If your platform/provider issues a `CODEX_API_KEY`, map it to `OPENAI_API_KEY` for this project runtime.
- Do not commit `.env.local`.

## 3. Setup & Installation (Platform Agnostic)

Run from repository root: `/Users/cirnovsky/repos/dlweek/TheSentinel`

### macOS / Linux

```bash
cd /Users/cirnovsky/repos/dlweek/TheSentinel
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm install
```

### Windows (PowerShell)

```powershell
cd C:\path\to\TheSentinel
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
npm install
```

### Windows (Command Prompt)

```bat
cd C:\path\to\TheSentinel
python -m venv .venv
.\.venv\Scripts\activate.bat
pip install -r requirements.txt
npm install
```

## 4. Running the Services

Start both services concurrently in separate terminals.

### Terminal A: Python backend (Sentinel API)

```bash
cd /Users/cirnovsky/repos/dlweek/TheSentinel
source .venv/bin/activate  # Windows: .\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal B: React frontend + app server

```bash
cd /Users/cirnovsky/repos/dlweek/TheSentinel
npm run dev
```

Frontend URL:
- `http://localhost:3000`

Python API URL:
- `http://localhost:8000/health`

## 5. How to Test / Evaluate (The Golden Path)

Judges should use the built-in in-app testing flow first.

1. Start services using Section 4.
2. Open `http://localhost:3000`.
3. Navigate to the **Interactive Sandbox** (`Test`) page.
4. Run the built-in scenarios:
- Data Wipe
- Environment Wipe
- Secret Exposure
5. Click **Load Scenario**, return to chat with prefilled malicious prompt, submit, and verify intercept behavior/risk report.

Detailed judge guide is in:
- [`testbench/TESTBENCH_SETUP.md`](/Users/cirnovsky/repos/dlweek/TheSentinel/testbench/TESTBENCH_SETUP.md)

Test resources are in:
- [`testbench/scripts/test_cases.md`](/Users/cirnovsky/repos/dlweek/TheSentinel/testbench/scripts/test_cases.md)
- [`testbench/scripts/ui_test_resources.json`](/Users/cirnovsky/repos/dlweek/TheSentinel/testbench/scripts/ui_test_resources.json)
