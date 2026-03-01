import subprocess
import os
import uuid
from typing import List, Dict, Any, Optional

# Integrating the required Codex SDKs as per hackathon specifications
from codex.sdk import CodexClient
from codex.mcp import MCPServer, tool
from codex.app_server import AppServer

# Initialize the Codex Client for code and text generation
codex_client = CodexClient()

# Initialize the MCP Server to expose the Git Skill to the AI Agent
mcp = MCPServer(name="SentinelGitSkill")

class SentinelGitManager:
    """
    Core logic for Git operations.
    """
    def __init__(self, repo_path: str):
        self.repo_path = repo_path
        if not os.path.exists(os.path.join(repo_path, '.git')):
            raise ValueError(f"Not a valid git repository: {repo_path}")

    def run_command(self, cmd: List[str]) -> str:
        try:
            result = subprocess.run(
                cmd,
                cwd=self.repo_path,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Git command failed: {' '.join(cmd)}\nError: {e.stderr.strip()}")

# Initialize the Git Manager for the current directory
git_manager = SentinelGitManager(os.getcwd())

@mcp.tool(name="create_isolated_branch", description="Creates a logically named, isolated branch for the task.")
def create_branch(task_name: str) -> str:
    safe_name = "".join(c if c.isalnum() else "-" for c in task_name).strip("-").lower()
    branch_name = f"sentinel/task-{safe_name}-{uuid.uuid4().hex[:6]}"
    git_manager.run_command(["git", "checkout", "-b", branch_name])
    return branch_name

@mcp.tool(name="get_changed_files", description="Gets a list of modified or untracked files.")
def get_changed_files() -> List[str]:
    status_output = git_manager.run_command(["git", "status", "--porcelain"])
    files = []
    for line in status_output.splitlines():
        if line:
            # porcelain format: XY PATH
            files.append(line[3:])
    return files

@mcp.tool(name="generate_commit_message", description="Generates a STAR methodology commit message based on the diff using Codex.")
def generate_star_commit_message(file_path: str, diff: str) -> str:
    prompt = f"""Analyze the following git diff for the file '{file_path}' and generate a commit message strictly using the STAR methodology.
Format your response exactly like this:
Update {file_path}

Situation: [Why is this change needed based on the diff?]
Task: [What was the specific goal of this commit?]
Action: [What exact code/logic was modified?]
Result: [What is the expected outcome or fixed behavior?]

Diff:
{diff}
"""
    try:
        # Use Codex SDK for generation
        response = codex_client.generate(
            prompt=prompt,
            model="codex-latest", # Target the Codex model
            temperature=0.2,
            max_tokens=250
        )
        return response.text.strip()
    except Exception as e:
        return f"Update {file_path}\n\nSituation: Automated commit processing.\nTask: Update {file_path}.\nAction: Applied diff changes.\nResult: Changes saved successfully.\n\n(Note: Codex generation failed - {str(e)})"

@mcp.tool(name="commit_file_atomically", description="Commits a single file using the STAR methodology.")
def commit_file(file_path: str) -> Dict[str, str]:
    git_manager.run_command(["git", "add", file_path])
    diff = git_manager.run_command(["git", "diff", "--cached", file_path])
    
    if not diff:
        git_manager.run_command(["git", "reset", "HEAD", file_path])
        return {"file": file_path, "status": "skipped", "reason": "No changes detected"}

    commit_msg = generate_star_commit_message(file_path, diff)
    
    msg_file = os.path.join(git_manager.repo_path, ".git", "COMMIT_MSG_TMP")
    with open(msg_file, "w") as f:
        f.write(commit_msg)
        
    try:
        git_manager.run_command(["git", "commit", "-F", msg_file])
        commit_hash = git_manager.run_command(["git", "rev-parse", "--short", "HEAD"])
        return {
            "file": file_path, 
            "status": "success", 
            "commit_hash": commit_hash,
            "message": commit_msg
        }
    finally:
        if os.path.exists(msg_file):
            os.remove(msg_file)

@mcp.tool(name="process_task_changes", description="Main workflow to process all changes into atomic commits.")
def process_task_changes(task_description: str) -> Dict[str, Any]:
    try:
        branch_name = create_branch(task_description)
        changed_files = get_changed_files()
        
        commits = []
        for file_path in changed_files:
            result = commit_file(file_path)
            if result["status"] == "success":
                commits.append(result)
                
        git_tree = git_manager.run_command(["git", "log", "--graph", "--oneline", "-n", str(len(commits) + 5)])
        
        return {
            "status": "success",
            "branch": branch_name,
            "total_commits": len(commits),
            "commits": commits,
            "git_tree": git_tree
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

# Initialize the App Server to host the MCP and handle requests
app = AppServer(name="SentinelApp")
app.attach_mcp(mcp)

if __name__ == "__main__":
    # Start the App Server on the designated port
    app.start(port=8080)
