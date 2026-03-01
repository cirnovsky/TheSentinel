from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel

from testbench.sentinel.git_skill import SentinelGitSkill
from testbench.sentinel.mcp_server import SentinelMCPServer

app = FastAPI(title="The Sentinel Python API", version="0.1.0")

mcp = SentinelMCPServer()


class AnalyzeProposalRequest(BaseModel):
    user_prompt: str
    command: str = ""
    python_code: str = ""


class AnalyzeDiffRequest(BaseModel):
    repo_path: str
    diff_text: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/mcp/analyze")
def analyze(request: AnalyzeProposalRequest) -> dict:
    return mcp.analyze_proposal(
        user_prompt=request.user_prompt,
        command=request.command,
        python_code=request.python_code,
    )


@app.post("/api/git/scan-diff")
def scan_diff(request: AnalyzeDiffRequest) -> dict[str, str]:
    skill = SentinelGitSkill(repo_path=request.repo_path)
    reason = skill._detect_secret_exposure(request.diff_text)  # noqa: SLF001
    if reason:
        return {"status": "BLOCKED", "justification": reason}
    return {"status": "ALLOWED", "justification": "No hardcoded secrets detected in diff."}
