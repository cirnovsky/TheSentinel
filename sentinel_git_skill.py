import subprocess
import os
import json
import uuid
from typing import List, Dict, Any, Optional
import openai

class SentinelGitSkill:
    """
    The Sentinel: Git Automation Skill
    Manages the lifecycle of AI-generated code changes to ensure strict accountability.
    """
    def __init__(self, repo_path: str, api_key: Optional[str] = None):
        self.repo_path = repo_path
        if not os.path.exists(os.path.join(repo_path, '.git')):
            raise ValueError(f"Not a valid git repository: {repo_path}")
        
        # Initialize OpenAI client for Codex/GPT code analysis
        self.client = openai.OpenAI(api_key=api_key or os.environ.get("OPENAI_API_KEY"))

    def _run_command(self, cmd: List[str]) -> str:
        """Executes a git command and returns the output."""
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

    def create_branch(self, task_name: str) -> str:
        """Creates a logically named, isolated branch for the task."""
        safe_name = "".join(c if c.isalnum() else "-" for c in task_name).strip("-").lower()
        branch_name = f"sentinel/task-{safe_name}-{uuid.uuid4().hex[:6]}"
        
        self._run_command(["git", "checkout", "-b", branch_name])
        return branch_name

    def get_changed_files(self) -> List[str]:
        """Gets a list of modified or untracked files."""
        status_output = self._run_command(["git", "status", "--porcelain"])
        files = []
        for line in status_output.splitlines():
            if line:
                # porcelain format: XY PATH
                files.append(line[3:])
        return files

    def generate_star_commit_message(self, file_path: str, diff: str) -> str:
        """
        Generates a STAR methodology commit message based on the diff using OpenAI/Codex.
        """
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
            response = self.client.chat.completions.create(
                model="gpt-4", # Or the specific codex/reasoning model required by your hackathon
                messages=[
                    {"role": "system", "content": "You are an expert software engineer and Git automation agent."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=250
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            # Fallback in case of API failure
            return f"""Update {file_path}

Situation: Automated commit processing.
Task: Update {file_path}.
Action: Applied diff changes.
Result: Changes saved successfully.

(Note: AI generation failed - {str(e)})"""

    def commit_file(self, file_path: str) -> Dict[str, str]:
        """Commits a single file using the STAR methodology."""
        self._run_command(["git", "add", file_path])
        
        # Get the diff for the staged file
        diff = self._run_command(["git", "diff", "--cached", file_path])
        
        if not diff:
            self._run_command(["git", "reset", "HEAD", file_path])
            return {"file": file_path, "status": "skipped", "reason": "No changes detected"}

        commit_msg = self.generate_star_commit_message(file_path, diff)
        
        # Write commit message to a temporary file to avoid command line escaping issues
        msg_file = os.path.join(self.repo_path, ".git", "COMMIT_MSG_TMP")
        with open(msg_file, "w") as f:
            f.write(commit_msg)
            
        try:
            self._run_command(["git", "commit", "-F", msg_file])
            commit_hash = self._run_command(["git", "rev-parse", "--short", "HEAD"])
            return {
                "file": file_path, 
                "status": "success", 
                "commit_hash": commit_hash,
                "message": commit_msg
            }
        finally:
            if os.path.exists(msg_file):
                os.remove(msg_file)

    def process_task_changes(self, task_description: str) -> Dict[str, Any]:
        """
        Main workflow:
        1. Create branch
        2. Identify changes
        3. Atomically commit each changed file
        4. Return summary
        """
        try:
            branch_name = self.create_branch(task_description)
            changed_files = self.get_changed_files()
            
            commits = []
            for file_path in changed_files:
                result = self.commit_file(file_path)
                if result["status"] == "success":
                    commits.append(result)
                    
            # Get the git tree representation
            git_tree = self._run_command(["git", "log", "--graph", "--oneline", "-n", str(len(commits) + 5)])
            
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

# Example usage:
# if __name__ == "__main__":
#     skill = SentinelGitSkill("/path/to/repo")
#     summary = skill.process_task_changes("Implement user authentication")
#     print(json.dumps(summary, indent=2))
