import { Commit, Message } from './types';

export const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'agent',
    content: 'Hello. I am The Sentinel. I manage your code changes with strict accountability. What task would you like me to perform?',
    timestamp: new Date().toISOString()
  }
];

export const INITIAL_BRANCHES: Record<string, Commit[]> = {
  'sentinel/task-auth-update-a1b2c3': [
    {
      id: '1',
      hash: 'a1b2c3d',
      author: 'The Sentinel',
      date: '10 mins ago',
      message: `Update src/auth/login.ts\n\nSituation: The codebase required updates to address the recent task requirements.\nTask: Modify src/auth/login.ts to implement the requested changes.\nAction: Updated logic and structures within src/auth/login.ts as per the diff.\nResult: The file now correctly reflects the intended behavior and integrates safely.`,
      diff: `--- a/src/auth/login.ts\n+++ b/src/auth/login.ts\n@@ -10,6 +10,10 @@ export async function login(req, res) {\n   const { username, password } = req.body;\n   \n   if (!username || !password) {\n-    return res.status(400).json({ error: 'Missing credentials' });\n+    return res.status(400).json({ error: 'Missing credentials' });\n+  }\n+  \n+  if (password.length < 8) {\n+    return res.status(400).json({ error: 'Password too short' });\n   }\n   \n   const user = await db.users.find({ username });`,
      files: ['src/auth/login.ts']
    },
    {
      id: '2',
      hash: 'e4f5g6h',
      author: 'The Sentinel',
      date: '12 mins ago',
      message: `Update src/db/schema.ts\n\nSituation: The database schema needed to support the new authentication flow.\nTask: Add password length validation to the user schema.\nAction: Modified the user model to enforce a minimum password length of 8 characters.\nResult: The database now rejects users with weak passwords at the schema level.`,
      diff: `--- a/src/db/schema.ts\n+++ b/src/db/schema.ts\n@@ -25,7 +25,8 @@ export const UserSchema = new Schema({\n   password: {\n     type: String,\n     required: true,\n-    select: false\n+    select: false,\n+    minlength: [8, 'Password must be at least 8 characters long']\n   },\n   createdAt: {\n     type: Date,`,
      files: ['src/db/schema.ts']
    },
    {
      id: '3',
      hash: 'i7j8k9l',
      author: 'Human Developer',
      date: '1 hour ago',
      message: 'Initial commit for authentication module',
      diff: `--- /dev/null\n+++ b/src/auth/index.ts\n@@ -0,0 +1,5 @@\n+export * from './login';\n+export * from './register';\n+export * from './logout';`,
      files: ['src/auth/index.ts']
    }
  ],
  'sentinel/task-ui-fixes-f9e8d7': [
    {
      id: '4',
      hash: 'b2c3d4e',
      author: 'The Sentinel',
      date: '2 hours ago',
      message: `Update src/components/Button.tsx\n\nSituation: The button component lacked proper hover states.\nTask: Add hover and active states to the primary button.\nAction: Added Tailwind classes for hover:bg-blue-600 and active:bg-blue-700.\nResult: The button now provides visual feedback on interaction.`,
      diff: `--- a/src/components/Button.tsx\n+++ b/src/components/Button.tsx\n@@ -5,7 +5,7 @@ export function Button({ children, onClick }) {\n   return (\n     <button \n       onClick={onClick}\n-      className="bg-blue-500 text-white px-4 py-2 rounded"\n+      className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white px-4 py-2 rounded transition-colors"\n     >\n       {children}\n     </button>`,
      files: ['src/components/Button.tsx']
    }
  ],
  'main': [
    {
      id: '5',
      hash: 'm1n2o3p',
      author: 'Human Developer',
      date: '1 day ago',
      message: 'Initial project setup',
      diff: `--- /dev/null\n+++ b/package.json\n@@ -0,0 +1,10 @@\n+{\n+  "name": "sentinel-project",\n+  "version": "1.0.0",\n+  "dependencies": {\n+    "react": "^18.2.0"\n+  }\n+}`,
      files: ['package.json']
    }
  ]
};
