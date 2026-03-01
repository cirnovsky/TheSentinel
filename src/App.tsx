import { useState } from 'react';
import { motion } from 'motion/react';
import { GitBranch, MessageSquare, Code2, Terminal, ShieldAlert } from 'lucide-react';
import ChatBox from './components/ChatBox';
import GitVisualizer from './components/GitVisualizer';
import CodeEditor from './components/CodeEditor';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'git'>('chat');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<any | null>(null);

  const handleSelectCommit = (commit: any) => {
    setSelectedCommit(commit);
    if (commit.files && commit.files.length > 0) {
      setSelectedFile(commit.files[0]);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] text-gray-300 font-sans overflow-hidden">
      {/* Sidebar / Left Pane */}
      <div className="w-[450px] flex flex-col border-r border-white/10 bg-[#111111] shrink-0">
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
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'chat' ? (
            <ChatBox />
          ) : (
            <GitVisualizer onSelectCommit={handleSelectCommit} />
          )}
        </div>
      </div>

      {/* Main Content / Right Pane */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
        {/* Editor Area */}
        <div className="flex-1 relative">
          <CodeEditor file={selectedFile} />
          
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
    </div>
  );
}
