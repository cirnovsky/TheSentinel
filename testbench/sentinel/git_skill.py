import math
import re
import subprocess
from pathlib import Path
from typing import Dict, Iterable, Optional, Tuple


class SentinelGitSkill:
    """Safe git helper with secret scanning before staging."""

    SENSITIVE_FILES = {"config.py", ".env"}
    SECRET_KEY_PATTERN = re.compile(
        r"\b(db_pass|db_password|password|passwd|secret|api_key|token|access_key)\b\s*[:=]\s*['\"]?([^'\"\s#]+)",
        flags=re.IGNORECASE,
    )

    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path)

    def safe_stage_file(self, file_path: str) -> Dict[str, str]:
        diff = self._git(["diff", "--", file_path])
        if not diff.strip():
            return {"status": "SKIPPED", "justification": "No unstaged diff detected."}

        blocked_reason = self._detect_secret_exposure(diff)
        if blocked_reason:
            return {"status": "BLOCKED", "justification": blocked_reason}

        self._git(["add", file_path])
        return {"status": "STAGED", "justification": "Diff passed secret checks."}

    def _detect_secret_exposure(self, diff_text: str) -> Optional[str]:
        for file_name, line in self._iter_added_lines(diff_text):
            if Path(file_name).name not in self.SENSITIVE_FILES:
                continue

            key_match = self.SECRET_KEY_PATTERN.search(line)
            if key_match:
                secret_value = key_match.group(2)
                if self._looks_like_secret(secret_value):
                    return (
                        f"Hardcoded credential detected in {file_name}: {key_match.group(1)}. "
                        "Use environment variables instead."
                    )

            for token in self._extract_quoted_tokens(line):
                if self._looks_like_secret(token):
                    return (
                        f"Potential high-entropy secret detected in {file_name}. "
                        "Commit blocked until credentials are removed."
                    )

        return None

    @staticmethod
    def _iter_added_lines(diff_text: str) -> Iterable[Tuple[str, str]]:
        current_file = ""
        for raw_line in diff_text.splitlines():
            if raw_line.startswith("+++ b/"):
                current_file = raw_line[6:]
                continue

            if raw_line.startswith("+") and not raw_line.startswith("+++"):
                yield current_file, raw_line[1:]

    @staticmethod
    def _extract_quoted_tokens(line: str) -> Iterable[str]:
        for match in re.finditer(r"['\"]([^'\"]{8,})['\"]", line):
            yield match.group(1)

    @staticmethod
    def _looks_like_secret(value: str) -> bool:
        if value.startswith("${") or value.startswith("os.getenv"):
            return False

        if len(value) >= 12 and re.search(r"[A-Za-z]", value) and re.search(r"\d", value):
            return True

        entropy = SentinelGitSkill._shannon_entropy(value)
        return len(value) >= 20 and entropy >= 3.5

    @staticmethod
    def _shannon_entropy(value: str) -> float:
        if not value:
            return 0.0

        counts = {}
        for char in value:
            counts[char] = counts.get(char, 0) + 1

        length = len(value)
        entropy = 0.0
        for count in counts.values():
            probability = count / length
            entropy -= probability * math.log2(probability)
        return entropy

    def _git(self, args: Iterable[str]) -> str:
        completed = subprocess.run(
            ["git", *args],
            cwd=self.repo_path,
            check=True,
            text=True,
            capture_output=True,
        )
        return completed.stdout
