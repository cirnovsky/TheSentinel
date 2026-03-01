import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { FileCode, Save } from 'lucide-react';

interface CodeEditorProps {
  file: string | null;
}

const MOCK_FILES: Record<string, string> = {
  'src/auth/login.ts': `export async function login(req, res) {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }
  
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password too short' });
  }
  
  const user = await db.users.find({ username });
  // ...
}`,
  'src/db/schema.ts': `import { Schema } from 'mongoose';

export const UserSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true,
    select: false,
    minlength: [8, 'Password must be at least 8 characters long']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});`,
  'src/auth/index.ts': `export * from './login';
export * from './register';
export * from './logout';`
};

export default function CodeEditor({ file }: CodeEditorProps) {
  const [code, setCode] = useState<string>('');
  const [isSaved, setIsSaved] = useState(true);

  useEffect(() => {
    if (file && MOCK_FILES[file]) {
      setCode(MOCK_FILES[file]);
      setIsSaved(true);
    } else {
      setCode('// Select a file to view or edit its contents\n// The Sentinel will track all changes made here.');
    }
  }, [file]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      setIsSaved(false);
    }
  };

  const handleSave = () => {
    setIsSaved(true);
    // In a real app, this would save to the file system
    console.log('Saved file:', file);
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
      
      <div className="flex-1 relative">
        <Editor
          height="100%"
          defaultLanguage="typescript"
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
