import json
import sqlite3
import re
from typing import Dict, Any, List
from enum import Enum

# Integrating the required Codex SDKs as per hackathon specifications
from codex.mcp import MCPServer, tool
from codex.app_server import AppServer

class RiskLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"

class SentinelSecurityAssessor:
    """
    Core logic for simulating and assessing the risk of proposed commands.
    """
    def __init__(self, db_path: str = ":memory:"):
        # Initialize a mock SQLite database for SQL dry runs
        self.db_path = db_path
        self._setup_mock_db()

    def _setup_mock_db(self):
        """Sets up a basic schema in the mock database for testing EXPLAIN queries."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL,
                email TEXT NOT NULL,
                role TEXT DEFAULT 'user'
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        ''')
        conn.commit()
        conn.close()

    def _assess_sql(self, query: str) -> Dict[str, Any]:
        """Assesses an SQL query using EXPLAIN and static analysis."""
        query_upper = query.upper()
        
        # Static Analysis for Risk
        risk_level = RiskLevel.LOW
        justification = "Standard read operation."
        rollback_available = True
        
        if "DROP" in query_upper or "TRUNCATE" in query_upper:
            risk_level = RiskLevel.CRITICAL
            justification = "Destructive operation detected (DROP/TRUNCATE). Data loss is permanent."
            rollback_available = False
        elif "DELETE" in query_upper:
            risk_level = RiskLevel.HIGH
            justification = "Data deletion detected. Requires careful review."
            rollback_available = False # Hard to rollback without backups
        elif "UPDATE" in query_upper or "INSERT" in query_upper:
            risk_level = RiskLevel.MEDIUM
            justification = "Data modification detected. Can usually be rolled back if in a transaction."
            rollback_available = True

        # Execution Plan via EXPLAIN
        execution_plan = []
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # We use EXPLAIN QUERY PLAN to see what SQLite would do without executing it
            cursor.execute(f"EXPLAIN QUERY PLAN {query}")
            plan_rows = cursor.fetchall()
            
            if plan_rows:
                execution_plan = [f"Step {i+1}: {row[-1]}" for i, row in enumerate(plan_rows)]
            else:
                execution_plan = ["Query parsed successfully, but no execution plan generated."]
                
        except sqlite3.Error as e:
            execution_plan = [f"Syntax Error or Invalid Query: {str(e)}"]
            risk_level = RiskLevel.HIGH
            justification = "Query failed validation. Executing this may cause application errors."
        finally:
            conn.close()

        return {
            "target_system": "Database (SQLite/SQL)",
            "execution_plan": execution_plan,
            "rollback_available": rollback_available,
            "risk_level": risk_level.value,
            "justification": justification
        }

    def _assess_bash(self, command: str) -> Dict[str, Any]:
        """Assesses a bash command or script using static analysis."""
        command_lower = command.lower()
        
        risk_level = RiskLevel.LOW
        justification = "Standard command execution."
        rollback_available = True
        execution_plan = [f"Execute shell command: `{command}`"]

        # Critical Risks
        if re.search(r'\brm\s+-r[fF]?\b', command_lower) or "> /dev/sda" in command_lower or "mkfs" in command_lower:
            risk_level = RiskLevel.CRITICAL
            justification = "Highly destructive file system operation detected (e.g., recursive remove or disk format)."
            rollback_available = False
            execution_plan.append("WARNING: This command will permanently delete files or format disks.")
            
        # High Risks
        elif re.search(r'\bchmod\s+-R\s+777\b', command_lower) or "chown" in command_lower or "iptables" in command_lower:
            risk_level = RiskLevel.HIGH
            justification = "Security boundary modification detected (permissions, ownership, or firewall)."
            rollback_available = False # Hard to revert to exact previous state automatically
            execution_plan.append("Modifies system permissions or network rules.")
            
        # Medium Risks (Package Managers)
        elif any(pkg in command_lower for pkg in ["apt-get install", "apt install", "yum install", "pip install", "npm install"]):
            risk_level = RiskLevel.MEDIUM
            justification = "Dependency installation or system package modification."
            rollback_available = True # Usually can uninstall
            
            # Attempt to simulate dry run
            if "pip install" in command_lower and "--dry-run" not in command_lower:
                execution_plan.append("Recommendation: Append `--dry-run` to pip install to see dependency resolution without installing.")
            elif "apt" in command_lower and "-s" not in command_lower and "--dry-run" not in command_lower:
                execution_plan.append("Recommendation: Use `apt-get install -s` for a simulated dry run.")

        return {
            "target_system": "Shell/OS",
            "execution_plan": execution_plan,
            "rollback_available": rollback_available,
            "risk_level": risk_level.value,
            "justification": justification
        }

# Initialize the Assessor
assessor = SentinelSecurityAssessor()

# Initialize the MCP Server
mcp = MCPServer(name="SentinelSecurityAssessor")

@mcp.tool(name="simulate_and_assess_impact", description="Provides a dry run and risk assessment for any script, database query, or dependency operation.")
def simulate_and_assess_impact(command: str, target_environment: str) -> str:
    """
    Analyzes a command and returns a JSON string containing the risk assessment.
    """
    # Determine command type based on basic heuristics
    is_sql = any(keyword in command.upper() for keyword in ["SELECT ", "INSERT ", "UPDATE ", "DELETE ", "CREATE ", "DROP ", "ALTER "])
    
    if is_sql:
        assessment = assessor._assess_sql(command)
    else:
        assessment = assessor._assess_bash(command)
        
    # Add the environment context
    assessment["environment"] = target_environment
    
    # Elevate risk if targeting production
    if target_environment.lower() in ["prod", "production", "live"]:
        if assessment["risk_level"] == RiskLevel.MEDIUM.value:
            assessment["risk_level"] = RiskLevel.HIGH.value
            assessment["justification"] += " (Risk elevated due to Production environment)."
        elif assessment["risk_level"] == RiskLevel.LOW.value:
            assessment["risk_level"] = RiskLevel.MEDIUM.value
            assessment["justification"] += " (Risk elevated due to Production environment)."

    return json.dumps(assessment, indent=2)

# Initialize the App Server to host the MCP
app = AppServer(name="SecurityAssessorApp")
app.attach_mcp(mcp)

if __name__ == "__main__":
    # Start the App Server on a different port than the Git Skill
    app.start(port=8081)
