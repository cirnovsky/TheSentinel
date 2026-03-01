import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { FileCode, Save, GitCommit } from 'lucide-react';

interface CodeEditorProps {
  file: string | null;
  files: Record<string, string>;
  onSaveFile: (filePath: string, content: string) => Promise<void>;
  onCommitFile: (filePath: string, content: string, goal: string) => Promise<void>;
}

function getEditorLanguage(filePath: string | null): string {
  if (!filePath) return 'plaintext';
  if (filePath.endsWith('.ts')) return 'typescript';
  if (filePath.endsWith('.tsx')) return 'typescript';
  if (filePath.endsWith('.js')) return 'javascript';
  if (filePath.endsWith('.jsx')) return 'javascript';
  if (filePath.endsWith('.json')) return 'json';
  if (filePath.endsWith('.md')) return 'markdown';
  if (filePath.endsWith('.css')) return 'css';
  if (filePath.endsWith('.html')) return 'html';
  if (filePath.endsWith('.py')) return 'python';
  if (filePath.endsWith('.sh')) return 'shell';
  return 'plaintext';
}

export default function CodeEditor({ file, files, onSaveFile, onCommitFile }: CodeEditorProps) {
  const [code, setCode] = useState<string>('');
  const [isSaved, setIsSaved] = useState(true);
  const [goal, setGoal] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  useEffect(() => {
    if (file && files[file] !== undefined) {
      setCode(files[file]);
      setIsSaved(true);
    } else if (file) {
      setCode(`// File not available in the current explorer scope:\n// ${file}`);
      setIsSaved(true);
    } else {
      setCode('// Select a file from File Explorer to view or edit its contents.');
      setIsSaved(true);
    }
  }, [file, files]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      setIsSaved(false);
    }
  };

  const handleSave = async () => {
    if (!file) return;
    await onSaveFile(file, code);
    setIsSaved(true);
  };

  const handleCommit = async () => {
    if (!file) return;
    setIsCommitting(true);
    try {
      await onCommitFile(file, code, goal.trim());
      setGoal('');
      setIsSaved(true);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <div className="h-10 border-b border-white/10 flex items-center justify-between px-4 bg-[#111111]">
        <div className="flex items-center gap-2 text-gray-400 text-xs font-mono">
          <FileCode size={14} />
          {file || 'No file selected'}
          {!isSaved && <span className="text-emerald-400 ml-2">*</span>}
        </div>
        
        <button
          onClick={handleSave}
          disabled={!file || isSaved}
          className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            !file || isSaved 
              ? 'bg-white/5 text-gray-500 cursor-not-allowed' 
              : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
          }`}
        >
          <Save size={14} />
          Save
        </button>
      </div>

      <div className="h-12 border-b border-white/10 flex items-center gap-2 px-3 bg-[#101010]">
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Human commit goal (Task in STAR message)"
          className="flex-1 h-8 bg-black/40 border border-white/10 rounded-md px-3 text-xs text-gray-200 focus:outline-none focus:border-emerald-500/50"
        />
        <button
          onClick={handleCommit}
          disabled={!file || isCommitting}
          className="h-8 px-3 rounded-md text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-1">
            <GitCommit size={13} />
            {isCommitting ? 'Committing...' : 'Commit'}
          </span>
        </button>
      </div>
      
      <div className="flex-1 relative">
        <Editor
          height="100%"
          language={getEditorLanguage(file)}
          theme="vs-dark"
          value={code}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            lineHeight: 1.6,
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            formatOnPaste: true,
          }}
        />
      </div>
    </div>
  );
}
