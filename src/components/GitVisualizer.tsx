import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GitBranch,
  Terminal,
  FileCode2,
  ChevronDown,
  Check,
  RotateCcw,
  Trash2,
  GitMerge,
  ShieldAlert,
  Undo2,
} from 'lucide-react';
import { Commit, GitState } from '../types';

interface GitVisualizerProps {
  branches: Record<string, Commit[]>;
  activeBranch: string;
  setActiveBranch: (branch: string) => void;
  onCheckoutCommit: (commit: Commit) => Promise<void>;
  onViewDiff: (commit: Commit) => void;
  onRevertCommit: (commitHash: string) => Promise<void>;
  onDeleteBranch: (branch: string) => Promise<void>;
  onDiscardBranch: (branch: string) => Promise<void>;
  onMergeBranch: (sourceBranch: string, targetBranch: string) => Promise<void>;
  onReturnToHead: () => Promise<void>;
  gitState: GitState;
}

export default function GitVisualizer({
  branches,
  activeBranch,
  setActiveBranch,
  onCheckoutCommit,
  onViewDiff,
  onRevertCommit,
  onDeleteBranch,
  onDiscardBranch,
  onMergeBranch,
  onReturnToHead,
  gitState,
}: GitVisualizerProps) {
  const [activeCommit, setActiveCommit] = useState<string | null>(null);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState('');
  const [showMergeSuggestions, setShowMergeSuggestions] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'ok' | 'error'>('ok');

  const branchEntries = useMemo(() => {
    return Object.entries(branches).sort((a, b) => {
      const aDate = a[1][0]?.date ? Date.parse(a[1][0].date) : 0;
      const bDate = b[1][0]?.date ? Date.parse(b[1][0].date) : 0;
      return bDate - aDate;
    });
  }, [branches]);

  const commits = branches[activeBranch] || [];
  const mergeSuggestions = useMemo(() => {
    const query = mergeTarget.trim().toLowerCase();
    return branchEntries
      .map(([branch]) => branch)
      .filter((branch) => branch !== activeBranch)
      .filter((branch) => (query ? branch.toLowerCase().includes(query) : true))
      .slice(0, 8);
  }, [branchEntries, activeBranch, mergeTarget]);

  const run = async (fn: () => Promise<void>, successMessage?: string) => {
    setIsBusy(true);
    setStatusMessage(null);
    try {
      await fn();
      if (successMessage) {
        setStatusType('ok');
        setStatusMessage(successMessage);
      }
    } catch (error) {
      setStatusType('error');
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto p-4 gap-4">
      <div className="rounded-xl border border-white/10 bg-[#121212] p-3 space-y-3">
        <div className="flex items-center justify-between relative">
          <button
            onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
            className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors z-10 max-w-[260px]"
          >
            <GitBranch size={16} className="shrink-0" />
            <span className="font-mono text-sm truncate">{activeBranch}</span>
            <ChevronDown size={14} className={`shrink-0 transition-transform ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          <span className="text-xs text-gray-500 font-mono">{commits.length} commits</span>

          <AnimatePresence>
            {isBranchDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 mt-2 w-80 bg-[#161616] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden"
              >
                <div className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-white/5">
                  Switch Branch (Newest First)
                </div>
                <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                  {branchEntries.map(([branch]) => (
                    <button
                      key={branch}
                      onClick={() => {
                        setActiveBranch(branch);
                        setIsBranchDropdownOpen(false);
                        setActiveCommit(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-mono transition-colors ${
                        activeBranch === branch ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                      }`}
                    >
                      <span className="truncate text-left">{branch}</span>
                      {activeBranch === branch && <Check size={14} className="shrink-0 ml-2" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="text-xs text-gray-400 bg-black/30 border border-white/10 rounded-md px-2 py-1 font-mono">
          {gitState.detached
            ? `Detached at ${gitState.head_hash}`
            : `On ${gitState.current_branch} @ ${gitState.head_hash}`}
          {gitState.pending_changes ? ' • pending changes' : ''}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => run(onReturnToHead, 'Returned to branch head.')}
            disabled={!gitState.detached || isBusy}
            className="h-9 rounded-md text-xs border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            <RotateCcw size={13} />
            Return To Head/Present
          </button>
          <button
            onClick={() => run(() => onDeleteBranch(activeBranch), `Deleted branch ${activeBranch}.`)}
            disabled={isBusy}
            className="h-9 rounded-md text-xs border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            <Trash2 size={13} />
            Delete Branch
          </button>
        </div>

        <div className="flex gap-2 relative">
          <input
            value={mergeTarget}
            onChange={(e) => {
              setMergeTarget(e.target.value);
              setShowMergeSuggestions(true);
            }}
            onFocus={() => setShowMergeSuggestions(true)}
            onBlur={() => setTimeout(() => setShowMergeSuggestions(false), 120)}
            placeholder="Merge target branch"
            className="flex-1 h-9 bg-black/40 border border-white/10 rounded-md px-3 text-xs text-gray-200 focus:outline-none focus:border-emerald-500/50"
          />
          {showMergeSuggestions && mergeSuggestions.length > 0 && (
            <div className="absolute left-0 right-[130px] top-10 z-20 max-h-56 overflow-y-auto rounded-md border border-white/10 bg-[#171717] shadow-2xl">
              {mergeSuggestions.map((branch) => (
                <button
                  key={branch}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setMergeTarget(branch);
                    setShowMergeSuggestions(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-mono text-gray-300 hover:bg-white/10"
                >
                  {branch}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() =>
              run(
                () => onMergeBranch(activeBranch, mergeTarget),
                `Merged ${activeBranch} into ${mergeTarget}.`,
              )
            }
            disabled={isBusy || !mergeTarget.trim() || mergeTarget.trim() === activeBranch}
            className="h-9 px-3 rounded-md text-xs border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 inline-flex items-center gap-1"
          >
            <GitMerge size={13} />
            Approve/Merge
          </button>
        </div>

        <button
          onClick={() => run(() => onDiscardBranch(activeBranch), `Discarded branch ${activeBranch}.`)}
          disabled={isBusy}
          className="w-full h-9 rounded-md text-xs border border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 disabled:opacity-50 inline-flex items-center justify-center gap-1"
        >
          <ShieldAlert size={13} />
          Reject & Discard Branch
        </button>

        {statusMessage && (
          <div
            className={`text-xs rounded-md px-2 py-1 border ${
              statusType === 'ok'
                ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                : 'text-rose-300 border-rose-500/30 bg-rose-500/10'
            }`}
          >
            {statusMessage}
          </div>
        )}
      </div>

      {isBranchDropdownOpen && <div className="fixed inset-0 z-0" onClick={() => setIsBranchDropdownOpen(false)} />}

      <div className="relative pl-4 border-l-2 border-white/10 space-y-5 z-0">
        {commits.length === 0 && (
          <div className="text-center py-10 text-gray-500 text-sm font-mono border border-dashed border-white/10 rounded-xl -ml-4">
            No commits yet on this branch.
          </div>
        )}
        {commits.map((commit) => (
          <motion.div key={commit.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="relative">
            <div className={`absolute -left-[21px] w-3 h-3 rounded-full border-2 border-[#0a0a0a] ${commit.author.includes('Sentinel') ? 'bg-emerald-500' : 'bg-blue-500'}`} />

            <div
              className={`bg-[#111111] border rounded-xl p-4 transition-all duration-200 ${
                activeCommit === commit.id ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-gray-500" />
                  <span className="font-mono text-sm text-gray-300">{commit.hash}</span>
                </div>
                <span className="text-xs text-gray-500">{commit.date}</span>
              </div>

              <div className="mb-3">
                <div className="text-sm font-medium text-gray-200 mb-1 line-clamp-1">{commit.message.split('\n')[0]}</div>
                <div className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{commit.message.split('\n').slice(1).join('\n').trim()}</div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5 mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${commit.author.includes('Sentinel') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {commit.author.includes('Sentinel') ? 'S' : 'H'}
                  </div>
                  <span className="text-xs text-gray-400">{commit.author}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-md">
                  <FileCode2 size={12} />
                  <span>{commit.files.length} file{commit.files.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => run(async () => {
                    setActiveCommit(commit.id);
                    await onCheckoutCommit(commit);
                  }, `Checked out ${commit.hash} safely.`)}
                  disabled={isBusy}
                  className="h-8 text-xs rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
                >
                  Checkout
                </button>
                <button
                  onClick={() => {
                    setActiveCommit(commit.id);
                    onViewDiff(commit);
                  }}
                  disabled={isBusy}
                  className="h-8 text-xs rounded-md border border-white/20 bg-white/5 text-gray-200 hover:bg-white/10 disabled:opacity-50"
                >
                  View Diff
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 mt-2">
                <button
                  onClick={() => run(() => onRevertCommit(commit.hash), `Reverted commit ${commit.hash}.`)}
                  disabled={isBusy || gitState.detached}
                  className="h-8 text-xs rounded-md border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                >
                  <Undo2 size={12} />
                  Revert Commit
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
