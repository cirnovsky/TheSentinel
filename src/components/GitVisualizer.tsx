import { useState } from 'react';
import { motion } from 'motion/react';
import { GitCommit, GitBranch, Terminal, FileCode2 } from 'lucide-react';

interface Commit {
  id: string;
  hash: string;
  author: string;
  date: string;
  message: string;
  diff: string;
  files: string[];
}

const MOCK_COMMITS: Commit[] = [
  {
    id: '1',
    hash: 'a1b2c3d',
    author: 'The Sentinel',
    date: '10 mins ago',
    message: `Update src/auth/login.ts

Situation: The codebase required updates to address the recent task requirements.
Task: Modify src/auth/login.ts to implement the requested changes.
Action: Updated logic and structures within src/auth/login.ts as per the diff.
Result: The file now correctly reflects the intended behavior and integrates safely.`,
    diff: `--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -10,6 +10,10 @@ export async function login(req, res) {
   const { username, password } = req.body;
   
   if (!username || !password) {
-    return res.status(400).json({ error: 'Missing credentials' });
+    return res.status(400).json({ error: 'Missing credentials' });
+  }
+  
+  if (password.length < 8) {
+    return res.status(400).json({ error: 'Password too short' });
   }
   
   const user = await db.users.find({ username });`,
    files: ['src/auth/login.ts']
  },
  {
    id: '2',
    hash: 'e4f5g6h',
    author: 'The Sentinel',
    date: '12 mins ago',
    message: `Update src/db/schema.ts

Situation: The database schema needed to support the new authentication flow.
Task: Add password length validation to the user schema.
Action: Modified the user model to enforce a minimum password length of 8 characters.
Result: The database now rejects users with weak passwords at the schema level.`,
    diff: `--- a/src/db/schema.ts
+++ b/src/db/schema.ts
@@ -25,7 +25,8 @@ export const UserSchema = new Schema({
   password: {
     type: String,
     required: true,
-    select: false
+    select: false,
+    minlength: [8, 'Password must be at least 8 characters long']
   },
   createdAt: {
     type: Date,`,
    files: ['src/db/schema.ts']
  },
  {
    id: '3',
    hash: 'i7j8k9l',
    author: 'Human Developer',
    date: '1 hour ago',
    message: 'Initial commit for authentication module',
    diff: `--- /dev/null
+++ b/src/auth/index.ts
@@ -0,0 +1,5 @@
+export * from './login';
+export * from './register';
+export * from './logout';`,
    files: ['src/auth/index.ts']
  }
];

interface GitVisualizerProps {
  onSelectCommit: (commit: Commit) => void;
}

export default function GitVisualizer({ onSelectCommit }: GitVisualizerProps) {
  const [activeCommit, setActiveCommit] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
          <GitBranch size={16} />
          <span className="font-mono text-sm">sentinel/task-auth-update-a1b2c3</span>
        </div>
        <span className="text-xs text-gray-500 font-mono">3 commits</span>
      </div>

      <div className="relative pl-4 border-l-2 border-white/10 space-y-8">
        {MOCK_COMMITS.map((commit, index) => (
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
