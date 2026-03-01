import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GitCommit, GitBranch, Terminal, FileCode2, ChevronDown, Check } from 'lucide-react';
import { Commit } from '../types';

interface GitVisualizerProps {
  branches: Record<string, Commit[]>;
  activeBranch: string;
  setActiveBranch: (branch: string) => void;
  onSelectCommit: (commit: Commit) => void;
}

export default function GitVisualizer({ branches, activeBranch, setActiveBranch, onSelectCommit }: GitVisualizerProps) {
  const [activeCommit, setActiveCommit] = useState<string | null>(null);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);

  const commits = branches[activeBranch] || [];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between relative">
        <button 
          onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
          className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors z-10 max-w-[250px]"
        >
          <GitBranch size={16} className="shrink-0" />
          <span className="font-mono text-sm truncate">{activeBranch}</span>
          <ChevronDown size={14} className={`shrink-0 transition-transform ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        <span className="text-xs text-gray-500 font-mono shrink-0 ml-2">{commits.length} commits</span>

        <AnimatePresence>
          {isBranchDropdownOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 mt-2 w-72 bg-[#161616] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden"
            >
              <div className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-white/5">
                Switch Branch
              </div>
              <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                {Object.keys(branches).map(branch => (
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

      {/* Close dropdown when clicking outside */}
      {isBranchDropdownOpen && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setIsBranchDropdownOpen(false)}
        />
      )}

      <div className="relative pl-4 border-l-2 border-white/10 space-y-8 z-0">
        {commits.length === 0 && (
          <div className="text-center py-10 text-gray-500 text-sm font-mono border border-dashed border-white/10 rounded-xl -ml-4">
            No commits yet on this branch.
          </div>
        )}
        {commits.map((commit, index) => (
          <motion.div
            key={commit.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative"
          >
            {/* Timeline Dot */}
            <div className={`absolute -left-[21px] w-3 h-3 rounded-full border-2 border-[#0a0a0a] ${
              commit.author === 'The Sentinel' ? 'bg-emerald-500' : 'bg-blue-500'
            }`} />

            {/* Commit Card */}
            <div 
              onClick={() => {
                setActiveCommit(commit.id);
                onSelectCommit(commit);
              }}
              className={`bg-[#111111] border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:border-emerald-500/50 ${
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

              <div className="mb-4">
                <div className="text-sm font-medium text-gray-200 mb-1 line-clamp-1">
                  {commit.message.split('\n')[0]}
                </div>
                <div className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                  {commit.message.split('\n').slice(1).join('\n').trim()}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    commit.author === 'The Sentinel' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {commit.author === 'The Sentinel' ? 'S' : 'H'}
                  </div>
                  <span className="text-xs text-gray-400">{commit.author}</span>
                </div>
                
                <div className="flex items-center gap-1 text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-md">
                  <FileCode2 size={12} />
                  <span>{commit.files.length} file{commit.files.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
