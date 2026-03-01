import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { GitBranch, MessageSquare, FlaskConical, Terminal, ShieldAlert } from 'lucide-react';
import ChatBox from './components/ChatBox';
import GitVisualizer from './components/GitVisualizer';
import CodeEditor from './components/CodeEditor';
import TestPage from './components/TestPage';
import FileExplorer from './components/FileExplorer';
import { Message, Commit, GitState, RuntimeStatus } from './types';
import { INITIAL_MESSAGES } from './data';
import { TESTBENCH_BLOG_FILES, DEFAULT_BLOG_FILE } from './testbenchFiles';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'git' | 'test'>(() => {
    const saved = localStorage.getItem('sentinel_active_tab');
    if (saved === 'chat' || saved === 'git' || saved === 'test') return saved;
    return 'test';
  });
  const [selectedFile, setSelectedFile] = useState<string | null>(() => {
    const saved = localStorage.getItem('sentinel_selected_file');
    return saved || DEFAULT_BLOG_FILE;
  });
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('sentinel_workspace_files');
    if (saved) {
      try {
        return { ...TESTBENCH_BLOG_FILES, ...JSON.parse(saved) };
      } catch (e) {}
    }
    return TESTBENCH_BLOG_FILES;
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('sentinel_messages');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return INITIAL_MESSAGES;
  });

  const [branches, setBranches] = useState<Record<string, Commit[]>>(() => {
    const saved = localStorage.getItem('sentinel_branches');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {};
  });

  const [activeBranch, setActiveBranch] = useState<string>('');
  const [gitState, setGitState] = useState<GitState>({
    current_branch: '',
    detached: false,
    head_hash: '',
    pending_changes: false,
  });
  const [stashRef, setStashRef] = useState<string | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>({
    mode: 'local_fallback',
    available: false,
    reason: 'Runtime status not loaded yet.',
  });
  const [chatPrefill, setChatPrefill] = useState<{ prompt: string; nonce: number }>({
    prompt: '',
    nonce: 0,
  });

  useEffect(() => {
    localStorage.setItem('sentinel_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('sentinel_branches', JSON.stringify(branches));
  }, [branches]);

  useEffect(() => {
    localStorage.setItem('sentinel_workspace_files', JSON.stringify(workspaceFiles));
  }, [workspaceFiles]);

  useEffect(() => {
    if (selectedFile) {
      localStorage.setItem('sentinel_selected_file', selectedFile);
    }
  }, [selectedFile]);

  useEffect(() => {
    localStorage.setItem('sentinel_active_tab', activeTab);
  }, [activeTab]);

  const refreshFromGit = async () => {
    try {
      const [filesResponse, branchesResponse, runtimeResponse] = await Promise.all([
        fetch('/api/testbench/files'),
        fetch('/api/agent/branches'),
        fetch('/api/runtime/status'),
      ]);

      if (filesResponse.ok) {
        const filesPayload = (await filesResponse.json()) as {files?: Record<string, string>};
        if (filesPayload.files) {
          setWorkspaceFiles(filesPayload.files);
        }
      }

      if (branchesResponse.ok) {
        const branchPayload = (await branchesResponse.json()) as {
          branches?: Record<string, Commit[]>;
          state?: GitState;
        };
        if (branchPayload.branches) {
          setBranches(branchPayload.branches);
          if (!gitState.detached) {
            const branchNames = Object.keys(branchPayload.branches);
            if (branchNames.length > 0 && !branchNames.includes(activeBranch)) {
              setActiveBranch(branchNames[0]);
            }
          }
        }
        if (branchPayload.state) {
          setGitState(branchPayload.state);
          if (!branchPayload.state.detached && branchPayload.state.current_branch) {
            setActiveBranch(branchPayload.state.current_branch);
          }
        }
      }

      if (runtimeResponse.ok) {
        const runtimePayload = (await runtimeResponse.json()) as RuntimeStatus;
        setRuntimeStatus(runtimePayload);
      }
    } catch {
      // Keep fallback data when local API is not available.
    }
  };

  useEffect(() => {
    refreshFromGit();
  }, []);

  const handleCheckoutCommit = async (commit: Commit) => {
    const response = await fetch('/api/git/checkout-commit', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({commitHash: commit.hash}),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || `Failed to checkout commit ${commit.hash}`);
    }
    if (response.ok) {
      const payload = (await response.json()) as {
        files?: Record<string, string>;
        state?: GitState;
        stash_ref?: string | null;
      };
      if (payload.files) setWorkspaceFiles(payload.files);
      if (payload.state) setGitState(payload.state);
      setStashRef(payload.stash_ref ?? null);
    }

    setSelectedCommit(commit);
    if (commit.files && commit.files.length > 0) {
      setSelectedFile(commit.files[0]);
    }
  };

  const handleViewDiff = (commit: Commit) => {
    setSelectedCommit(commit);
    if (commit.files && commit.files.length > 0) {
      setSelectedFile(commit.files[0]);
    }
  };

  const handleSaveFile = async (filePath: string, content: string) => {
    const response = await fetch('/api/file/save', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({filePath, content}),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || 'Failed to save file');
    }
    const payload = (await response.json()) as {files?: Record<string, string>; state?: GitState};
    if (payload.files) setWorkspaceFiles(payload.files);
    if (payload.state) setGitState(payload.state);
  };

  const handleCommitFile = async (filePath: string, content: string, goal: string) => {
    await handleSaveFile(filePath, content);
    const response = await fetch('/api/git/commit-human', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({filePath, goal}),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || 'Failed to commit file');
    }
    await refreshFromGit();
  };

  const handleTaskRequested = async (prompt: string, options?: { allowDestructive?: boolean }) => {
    const response = await fetch('/api/agent/task', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({prompt, allow_destructive: Boolean(options?.allowDestructive)}),
    });

    if (!response.ok) {
      const raw = await response.text();
      try {
        const parsed = JSON.parse(raw) as { error?: string };
        throw new Error(parsed.error || raw || 'Failed to run task');
      } catch {
        throw new Error(raw || 'Failed to run task');
      }
    }

    const result = (await response.json()) as {
      branch: string;
      commits: Commit[];
      branch_commits?: Commit[];
      total_commits: number;
      git_tree: string;
      files: Record<string, string>;
      state?: GitState;
    };

    setWorkspaceFiles(result.files);
    setBranches((prev) => ({
      ...prev,
      [result.branch]: result.branch_commits ?? result.commits ?? [],
    }));
    setActiveBranch(result.branch);
    if (result.state) {
      setGitState(result.state);
    }

    if (result.commits.length > 0 && result.commits[0].files.length > 0) {
      setSelectedFile(result.commits[0].files[0]);
    }

    return {
      branchName: result.branch,
      totalCommits: result.total_commits,
      gitTree: result.git_tree,
    };
  };

  const handleSwitchBranch = async (branch: string) => {
    if (branch === activeBranch && !gitState.detached) return;
    const response = await fetch('/api/git/return-head', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({branch}),
    });
    if (response.ok) {
      const payload = (await response.json()) as {files?: Record<string, string>; state?: GitState};
      if (payload.files) setWorkspaceFiles(payload.files);
      if (payload.state) setGitState(payload.state);
      setActiveBranch(branch);
      setStashRef(null);
      await refreshFromGit();
    }
  };

  const handleRevertCommit = async (commitHash: string) => {
    const response = await fetch('/api/git/revert', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({commitHash}),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || 'Failed to revert commit');
    }
    await refreshFromGit();
  };

  const handleDeleteBranch = async (branch: string) => {
    const response = await fetch('/api/git/delete-branch', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({branch, fallbackBranch: ''}),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || 'Failed to delete branch');
    }
    await refreshFromGit();
  };

  const handleDiscardBranch = async (branch: string) => {
    const response = await fetch('/api/git/discard-branch', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({branch, fallbackBranch: ''}),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || 'Failed to discard branch');
    }
    await refreshFromGit();
  };

  const handleMergeBranch = async (sourceBranch: string, targetBranch: string) => {
    const response = await fetch('/api/git/merge', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({sourceBranch, targetBranch}),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || 'Failed to merge branch');
    }
    setActiveBranch(targetBranch);
    await refreshFromGit();
  };

  const handleReturnToHead = async () => {
    const response = await fetch('/api/git/return-head', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({branch: activeBranch, stashRef}),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || 'Failed to return to branch head');
    }
    const payload = (await response.json()) as {files?: Record<string, string>; state?: GitState};
    if (payload.files) setWorkspaceFiles(payload.files);
    if (payload.state) setGitState(payload.state);
    setStashRef(null);
    await refreshFromGit();
  };

  const handleLoadScenario = async (prompt: string) => {
    const response = await fetch('/api/reset-sandbox', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || 'Failed to reset sandbox');
    }
    await refreshFromGit();
    setActiveTab('chat');
    setChatPrefill({ prompt, nonce: Date.now() });
  };

  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] text-gray-300 font-sans overflow-hidden">
      {/* Main Content / Left Pane */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0a0a0a]">
        {activeTab === 'test' ? (
          <TestPage onLoadScenario={handleLoadScenario} />
        ) : (
          <div className="flex-1 flex min-w-0 min-h-0">
            <FileExplorer
              filePaths={Object.keys(workspaceFiles)}
              selectedFile={selectedFile}
              onSelectFile={setSelectedFile}
            />
            <div className="flex-1 relative min-w-0 min-h-0">
              <CodeEditor
                file={selectedFile}
                files={workspaceFiles}
                onSaveFile={handleSaveFile}
                onCommitFile={handleCommitFile}
              />
            
              {/* Diff Overlay if a commit is selected */}
              {selectedCommit && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-4 right-4 left-4 bg-[#161616] border border-white/10 rounded-xl shadow-2xl p-4 z-10 max-h-[400px] flex flex-col"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Terminal size={16} className="text-emerald-400" />
                      <span className="font-mono text-sm text-white">{selectedCommit.hash}</span>
                      <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{selectedCommit.author}</span>
                    </div>
                    <button 
                      onClick={() => setSelectedCommit(null)}
                      className="text-gray-500 hover:text-white text-sm"
                    >
                      Close Diff
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto font-mono text-xs leading-relaxed bg-black/50 p-3 rounded-lg border border-white/5">
                    <div className="text-gray-400 mb-2 whitespace-pre-wrap">{selectedCommit.message}</div>
                    <div className="h-px w-full bg-white/10 my-2" />
                    {selectedCommit.diff.split('\n').map((line: string, i: number) => {
                      let color = 'text-gray-400';
                      if (line.startsWith('+')) color = 'text-emerald-400 bg-emerald-400/10';
                      if (line.startsWith('-')) color = 'text-rose-400 bg-rose-400/10';
                      if (line.startsWith('@@')) color = 'text-blue-400';
                      return (
                        <div key={i} className={`${color} px-1 rounded-sm`}>
                          {line}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar / Right Pane */}
      <div className="w-[450px] flex flex-col border-l border-white/10 bg-[#111111] shrink-0">
        {/* Header */}
        <div className="h-14 border-b border-white/10 flex items-center px-4 justify-between bg-[#161616]">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldAlert size={20} />
            <span className="font-semibold tracking-wide text-sm">THE SENTINEL</span>
          </div>
          <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
            <button
              onClick={() => setActiveTab('chat')}
              className={`p-1.5 rounded-md transition-colors ${activeTab === 'chat' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              title="Chat"
            >
              <MessageSquare size={16} />
            </button>
            <button
              onClick={() => setActiveTab('git')}
              className={`p-1.5 rounded-md transition-colors ${activeTab === 'git' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              title="Git Tree"
            >
              <GitBranch size={16} />
            </button>
            <button
              onClick={() => setActiveTab('test')}
              className={`px-2 py-1.5 rounded-md transition-colors inline-flex items-center gap-1 ${activeTab === 'test' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              title="Test"
            >
              <FlaskConical size={16} />
              <span className="text-xs font-medium">Test</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative min-h-0">
          {activeTab === 'chat' ? (
            <ChatBox 
              messages={messages} 
              setMessages={setMessages} 
              onTaskRequested={handleTaskRequested}
              runtimeStatus={runtimeStatus}
              prefillPrompt={chatPrefill.prompt}
              prefillNonce={chatPrefill.nonce}
            />
          ) : activeTab === 'git' ? (
            <GitVisualizer 
              branches={branches}
              activeBranch={activeBranch}
              setActiveBranch={handleSwitchBranch}
              onCheckoutCommit={handleCheckoutCommit}
              onViewDiff={handleViewDiff}
              onRevertCommit={handleRevertCommit}
              onDeleteBranch={handleDeleteBranch}
              onDiscardBranch={handleDiscardBranch}
              onMergeBranch={handleMergeBranch}
              onReturnToHead={handleReturnToHead}
              gitState={gitState}
            />
          ) : (
            <div className="h-full bg-[#0a0a0a] p-4">
              <div className="h-full rounded-xl border border-white/10 bg-[#141414] p-4">
                <p className="text-sm text-gray-300">Run scenarios from the left panel Test Page.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
