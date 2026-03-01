import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, PlayCircle, ShieldAlert } from 'lucide-react';
import testResourcesRaw from '../../testbench/scripts/ui_test_resources.json?raw';

type MCPReport = {
  target_system: string;
  risk_level: 'LOW' | 'CRITICAL';
  requires_human_consent: boolean;
  rollback_available: boolean;
  halt_execution: boolean;
  justification: string;
  execution_plan: string[];
};

type GitReport = {
  status: 'BLOCKED' | 'ALLOWED';
  justification: string;
};

type TestCase = {
  id: string;
  title: string;
  user_prompt: string;
  expected_behavior: string;
  runner: 'mcp' | 'git';
  proposed_command?: string;
  proposed_diff?: string;
  expected_report: Record<string, unknown>;
};

type TestResult = {
  id: string;
  passed: boolean;
  report: MCPReport | GitReport;
};

function runMcpGuard(command: string): MCPReport {
  const normalized = command.toLowerCase();

  const environmentWipe = /rm\s+-r[fF]?\s+.*\b(venv|\.git|node_modules)\/?\b/i.test(command);
  if (environmentWipe) {
    return {
      target_system: 'Developer Environment',
      risk_level: 'CRITICAL',
      requires_human_consent: true,
      rollback_available: false,
      halt_execution: true,
      justification: 'Recursive deletion targets core infrastructure folders.',
      execution_plan: [
        `Analyze command: ${command}`,
        'Critical delete operation detected for venv/.git/node_modules.',
      ],
    };
  }

  const dataWipe =
    /rm\s+-r[fF]?\s+.*testbench\/blog\/database\/posts/i.test(command) ||
    (normalized.includes('delete') && normalized.includes('testbench/blog/database/posts'));

  if (dataWipe) {
    return {
      target_system: 'Local File Storage',
      risk_level: 'CRITICAL',
      requires_human_consent: true,
      rollback_available: false,
      halt_execution: true,
      justification: 'Deletion operation targets blog posts storage.',
      execution_plan: [
        `Analyze command: ${command}`,
        'Destructive post deletion detected. Human approval required.',
      ],
    };
  }

  return {
    target_system: 'Shell/OS',
    risk_level: 'LOW',
    requires_human_consent: false,
    rollback_available: true,
    halt_execution: false,
    justification: 'No destructive pattern detected.',
    execution_plan: [`Analyze command: ${command}`],
  };
}

function runGitGuard(diff: string): GitReport {
  const secretPattern =
    /\+(?:\s*)?(db_pass|db_password|password|secret|api_key|token)\s*[:=]\s*['\"][^'\"]+['\"]/i;
  const sensitiveFile = /\+\+\+ b\/(config\.py|\.env)/i.test(diff);

  if (sensitiveFile && secretPattern.test(diff)) {
    return {
      status: 'BLOCKED',
      justification:
        'Hardcoded credential detected in config.py/.env diff. Use environment variables instead.',
    };
  }

  return {
    status: 'ALLOWED',
    justification: 'No hardcoded secrets detected in staged diff.',
  };
}

function reportMatchesExpectation(
  report: MCPReport | GitReport,
  expectedReport: Record<string, unknown>,
): boolean {
  return Object.entries(expectedReport).every(([key, expectedValue]) => {
    return (report as Record<string, unknown>)[key] === expectedValue;
  });
}

export default function TestPage() {
  const testCases = useMemo(() => JSON.parse(testResourcesRaw) as TestCase[], []);
  const [activeResult, setActiveResult] = useState<TestResult | null>(null);

  const runCase = (testCase: TestCase) => {
    const report =
      testCase.runner === 'mcp'
        ? runMcpGuard(testCase.proposed_command ?? '')
        : runGitGuard(testCase.proposed_diff ?? '');

    setActiveResult({
      id: testCase.id,
      passed: reportMatchesExpectation(report, testCase.expected_report),
      report,
    });
  };

  const activeCase = testCases.find((item) => item.id === activeResult?.id) ?? null;

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0a] p-6">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-wider text-emerald-300">
          <ShieldAlert size={14} />
          Sentinel Test Page
        </div>
        <h2 className="mt-3 text-2xl font-semibold text-white">Run Safety Scenarios</h2>
        <p className="mt-1 text-sm text-gray-400">
          Prompts and expected behavior are loaded from files under <code>testbench/scripts</code>.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {testCases.map((testCase) => (
          <button
            key={testCase.id}
            onClick={() => runCase(testCase)}
            className="rounded-xl border border-white/10 bg-[#161616] p-4 text-left transition-colors hover:border-emerald-500/40 hover:bg-[#1a1a1a]"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-white">{testCase.title}</span>
              <PlayCircle size={16} className="text-emerald-400" />
            </div>
            <p className="text-xs text-gray-400 line-clamp-4">{testCase.user_prompt}</p>
          </button>
        ))}
      </div>

      {activeCase && activeResult && (
        <div className="mt-6 rounded-xl border border-white/10 bg-[#121212] p-5">
          <div className="mb-4 flex items-center gap-2">
            {activeResult.passed ? (
              <CheckCircle2 size={18} className="text-emerald-400" />
            ) : (
              <AlertTriangle size={18} className="text-rose-400" />
            )}
            <span className={`text-sm font-semibold ${activeResult.passed ? 'text-emerald-300' : 'text-rose-300'}`}>
              {activeResult.passed ? 'PASS' : 'FAIL'}
            </span>
            <span className="text-sm text-gray-300">{activeCase.title}</span>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-gray-500">User Prompt</div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-gray-200">
                {activeCase.user_prompt}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-gray-500">Expected Behavior</div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-gray-200">
                {activeCase.expected_behavior}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-gray-500">Actual JSON Report</div>
              <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-gray-200">
                {JSON.stringify(activeResult.report, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
