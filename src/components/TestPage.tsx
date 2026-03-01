import { useMemo, useState } from 'react';
import { ChevronDown, ShieldAlert } from 'lucide-react';
import testResourcesRaw from '../../testbench/scripts/ui_test_resources.json?raw';

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

type LoadState = {
  scenarioId: string;
  loading: boolean;
  error: string;
};

interface TestPageProps {
  onLoadScenario: (prompt: string) => Promise<void>;
}

function scenarioThreat(testCase: TestCase): string {
  if (testCase.id === 'data_wipe') {
    return 'Unchecked delete operations can wipe historical content and permanently erase local blog data.';
  }
  if (testCase.id === 'environment_wipe') {
    return 'Recursive deletes against environment folders can break the repository and development setup irreversibly.';
  }
  if (testCase.id === 'secret_exposure') {
    return 'Committing plaintext credentials leaks secrets into git history and risks production compromise.';
  }
  return 'This scenario validates Sentinel safeguards against high-impact coding-agent actions.';
}

export default function TestPage({ onLoadScenario }: TestPageProps) {
  const testCases = useMemo(() => JSON.parse(testResourcesRaw) as TestCase[], []);
  const [expandedId, setExpandedId] = useState<string | null>(testCases[0]?.id ?? null);
  const [loadState, setLoadState] = useState<LoadState | null>(null);

  const handleLoadScenario = async (testCase: TestCase) => {
    setLoadState({ scenarioId: testCase.id, loading: true, error: '' });
    try {
      await onLoadScenario(testCase.user_prompt);
      setLoadState(null);
    } catch (error) {
      setLoadState({
        scenarioId: testCase.id,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0a] p-6">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-wider text-emerald-300">
          <ShieldAlert size={14} />
          Sentinel Test Page
        </div>
        <h2 className="mt-3 text-2xl font-semibold text-white">Guided Demo Scenarios</h2>
        <p className="mt-1 text-sm text-gray-400">
          Load a scenario to reset sandbox state, return to chat, and prefill the malicious prompt for one-click execution.
        </p>
      </div>

      <div className="space-y-3">
        {testCases.map((testCase) => {
          const expanded = expandedId === testCase.id;
          const isLoading = loadState?.scenarioId === testCase.id && loadState.loading;
          const loadError = loadState?.scenarioId === testCase.id ? loadState.error : '';

          return (
            <div key={testCase.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#161616]">
              <button
                onClick={() => setExpandedId(expanded ? null : testCase.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[#1a1a1a]"
              >
                <span className="text-sm font-medium text-white">{testCase.title}</span>
                <ChevronDown
                  size={16}
                  className={`text-emerald-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              </button>

              {expanded && (
                <div className="space-y-4 border-t border-white/10 bg-[#121212] px-4 py-4 text-sm">
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wider text-gray-500">The Threat</div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-gray-200">
                      {scenarioThreat(testCase)}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wider text-gray-500">The Prompt</div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-gray-200">
                      {testCase.user_prompt}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wider text-gray-500">Expected Behavior</div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-gray-200">
                      {testCase.expected_behavior}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() => handleLoadScenario(testCase)}
                      disabled={isLoading}
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoading ? 'Loading Scenario...' : 'Load Scenario'}
                    </button>
                    {loadError ? <span className="text-xs text-rose-400">{loadError}</span> : null}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
