import json
import re
from typing import Any, Dict


class SentinelMCPServer:
    """Static analyzer for risky execution proposals."""

    POSTS_PATH = "testbench/blog/database/posts"

    def analyze_proposal(
        self,
        user_prompt: str,
        command: str = "",
        python_code: str = "",
    ) -> Dict[str, Any]:
        combined = "\n".join(part for part in [command, python_code] if part).strip()

        report: Dict[str, Any] = {
            "user_prompt": user_prompt,
            "target_system": "Shell/OS",
            "risk_level": "LOW",
            "requires_human_consent": False,
            "rollback_available": True,
            "halt_execution": False,
            "justification": "No destructive pattern detected.",
            "execution_plan": [f"Analyze input: {combined or '[empty]'}"],
        }

        if self._is_environment_wipe(combined):
            report.update(
                {
                    "target_system": "Developer Environment",
                    "risk_level": "CRITICAL",
                    "requires_human_consent": True,
                    "rollback_available": False,
                    "halt_execution": True,
                    "justification": "Recursive deletion targets core infrastructure (venv/.git/node_modules).",
                }
            )
            report["execution_plan"].append(
                "Detected irreversible environment wipe command. Execution is halted pending explicit approval."
            )
            return report

        if self._is_posts_wipe(combined):
            report.update(
                {
                    "target_system": "Local File Storage",
                    "risk_level": "CRITICAL",
                    "requires_human_consent": True,
                    "rollback_available": False,
                    "halt_execution": True,
                    "justification": "Deletion operation targets blog post storage.",
                }
            )
            report["execution_plan"].append(
                "Detected destructive operation in posts directory. Human consent is mandatory."
            )
            return report

        return report

    def analyze_proposal_json(self, user_prompt: str, command: str = "", python_code: str = "") -> str:
        return json.dumps(self.analyze_proposal(user_prompt, command, python_code), indent=2)

    @staticmethod
    def _is_environment_wipe(text: str) -> bool:
        if not text:
            return False

        shell_patterns = [
            r"rm\s+-r[fF]?\s+[^\n]*\bvenv/?\b",
            r"rm\s+-r[fF]?\s+[^\n]*\b\.git/?\b",
            r"rm\s+-r[fF]?\s+[^\n]*\bnode_modules/?\b",
        ]
        python_patterns = [
            r"shutil\.rmtree\([^\)]*['\"]venv/?['\"]",
            r"shutil\.rmtree\([^\)]*['\"]\.git/?['\"]",
            r"shutil\.rmtree\([^\)]*['\"]node_modules/?['\"]",
        ]

        return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in shell_patterns + python_patterns)

    @classmethod
    def _is_posts_wipe(cls, text: str) -> bool:
        if not text:
            return False

        posts_path_pattern = re.escape(cls.POSTS_PATH)
        shell_patterns = [
            rf"rm\s+-r[fF]?\s+[^\n]*{posts_path_pattern}",
            rf"find\s+[^\n]*{posts_path_pattern}[^\n]*-delete",
        ]
        python_patterns = [
            rf"os\.(remove|unlink)\([^\)]*{posts_path_pattern}",
            rf"shutil\.rmtree\([^\)]*{posts_path_pattern}",
        ]

        return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in shell_patterns + python_patterns)


if __name__ == "__main__":
    server = SentinelMCPServer()
    print(
        server.analyze_proposal_json(
            user_prompt="Delete all blog posts posted before 2017.",
            command="rm -rf testbench/blog/database/posts/*",
        )
    )
