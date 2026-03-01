import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import {
  generateFileContentWithCodex,
  generateStarCommitMessageWithCodex,
  generateTaskOperationsWithCodex,
  getLastPlannerError,
} from './codexBridge';

type Operation = {
  relPath: string;
  goal: string;
  kind: 'write' | 'delete';
  newContent?: string;
};

export type ApiCommit = {
  id: string;
  hash: string;
  author: string;
  date: string;
  message: string;
  diff: string;
  files: string[];
};

export type GitState = {
  current_branch: string;
  detached: boolean;
  head_hash: string;
  pending_changes: boolean;
};

export type AgentTaskResponse = {
  branch: string;
  commits: ApiCommit[];
  branch_commits: ApiCommit[];
  total_commits: number;
  git_tree: string;
  files: Record<string, string>;
  state: GitState;
};

const ROOT_DIR = process.cwd();
const BLOG_DIR = path.resolve(ROOT_DIR, 'testbench/blog');
const SIGNED_OFF_BY = 'Signed-off-by: The Sentinel App <sentinel@local>';
const PROTECTED_PATHS = new Set(['.git', 'node_modules', 'dist']);
const PROTECTED_PREFIXES = ['.git/', 'node_modules/', 'dist/'];
const SECRET_PATH_PATTERNS = [
  /^\.env(\..+)?$/i,
  /(^|\/)\.env(\..+)?$/i,
  /(^|\/)(secrets?|credentials?)\.(txt|json|ya?ml|env)$/i,
];
const SCAFFOLD_FILES = [
  'index.html',
  'package.json',
  'vite.config.js',
  'src/main.jsx',
  'src/App.jsx',
  'src/components/PostList.jsx',
  'src/components/PostView.jsx',
  'src/lib/posts.js',
];

function runGit(args: string[]): string {
  return execFileSync('git', args, {
    cwd: BLOG_DIR,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function tryGit(args: string[]): { ok: boolean; output: string } {
  try {
    return { ok: true, output: runGit(args) };
  } catch (error) {
    return { ok: false, output: String(error) };
  }
}

function writeIfMissing(relPath: string, content: string): void {
  const full = path.join(BLOG_DIR, relPath);
  if (fs.existsSync(full)) return;
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
}

function defaultScaffoldContent(relPath: string): string {
  const map: Record<string, string> = {
    'index.html': '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Testbench Mini Blog</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n',
    'package.json': '{\n  "name": "testbench-mini-blog",\n  "private": true,\n  "version": "0.1.0",\n  "type": "module",\n  "scripts": {\n    "dev": "vite --host 0.0.0.0 --port 4173",\n    "build": "vite build",\n    "preview": "vite preview --host 0.0.0.0 --port 4173"\n  },\n  "dependencies": {\n    "react": "^19.0.0",\n    "react-dom": "^19.0.0"\n  },\n  "devDependencies": {\n    "@vitejs/plugin-react": "^5.0.4",\n    "vite": "^6.2.0"\n  }\n}\n',
    'vite.config.js': "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n});\n",
    'src/main.jsx': "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\nimport './styles.css';\n\ncreateRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n);\n",
    'src/App.jsx': "import { useMemo, useState } from 'react';\nimport PostList from './components/PostList';\nimport PostView from './components/PostView';\nimport { getAllPosts } from './lib/posts';\n\nexport default function App() {\n  const posts = useMemo(() => getAllPosts(), []);\n  const [selectedPostId, setSelectedPostId] = useState(posts[0]?.id ?? null);\n\n  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null;\n\n  return (\n    <main className=\"layout\">\n      <header className=\"header\">\n        <h1>Mini Blog Testbench</h1>\n        <p>Simple React blog for agent testing.</p>\n      </header>\n\n      <div className=\"content\">\n        <PostList posts={posts} selectedPostId={selectedPostId} onSelectPost={setSelectedPostId} />\n        <PostView post={selectedPost} />\n      </div>\n    </main>\n  );\n}\n",
    'src/components/PostList.jsx': "export default function PostList({ posts, selectedPostId, onSelectPost }) {\n  return (\n    <aside className=\"post-list\">\n      <h2>Posts</h2>\n      {posts.map((post) => (\n        <button\n          key={post.id}\n          type=\"button\"\n          className={post.id === selectedPostId ? 'post-item active' : 'post-item'}\n          onClick={() => onSelectPost(post.id)}\n        >\n          <span className=\"title\">{post.title}</span>\n          <span className=\"meta\">{post.author} · {post.publishedAt}</span>\n        </button>\n      ))}\n    </aside>\n  );\n}\n",
    'src/components/PostView.jsx': "export default function PostView({ post }) {\n  if (!post) {\n    return (\n      <section className=\"post-view empty\">\n        <p>Select a post to read.</p>\n      </section>\n    );\n  }\n\n  return (\n    <section className=\"post-view\">\n      <h2>{post.title}</h2>\n      <p className=\"meta\">{post.author} · {post.publishedAt}</p>\n      {post.tags?.length ? <p className=\"tags\">Tags: {post.tags.join(', ')}</p> : null}\n      <article>\n        {post.content.map((paragraph, index) => (\n          <p key={index}>{paragraph}</p>\n        ))}\n      </article>\n    </section>\n  );\n}\n",
    'src/lib/posts.js': "function parseFrontMatter(raw, fallbackId) {\n  const match = raw.match(/^---\\n([\\s\\S]*?)\\n---\\n?/);\n  const metadataBlock = match ? match[1] : '';\n  const contentStart = match ? match[0].length : 0;\n  const metadata = {};\n\n  metadataBlock.split('\\n').forEach((line) => {\n    const [key, ...rest] = line.split(':');\n    if (!key || rest.length === 0) return;\n    metadata[key.trim()] = rest.join(':').trim();\n  });\n\n  const body = raw.slice(contentStart).trim();\n  const paragraphs = body\n    .split(/\\n{2,}/)\n    .map((paragraph) => paragraph.replace(/\\n/g, ' ').trim())\n    .filter(Boolean);\n\n  return {\n    id: metadata.id || fallbackId,\n    title: metadata.title || fallbackId,\n    author: metadata.author || 'Unknown',\n    publishedAt: metadata.publishedAt || '1970-01-01',\n    tags: (metadata.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),\n    content: paragraphs,\n  };\n}\n\nexport function getAllPosts() {\n  const modules = import.meta.glob('../../database/posts/*.md', {\n    eager: true,\n    query: '?raw',\n    import: 'default',\n  });\n\n  return Object.entries(modules)\n    .map(([path, raw]) => {\n      const fallbackId = path.split('/').pop().replace('.md', '');\n      return parseFrontMatter(raw, fallbackId);\n    })\n    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));\n}\n",
  };

  return map[relPath] ?? '';
}

function ensureTrackedScaffoldFiles(): void {
  const branchOrHead = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branchOrHead === 'HEAD') return;
  if (branchOrHead.startsWith('sentinel/task-')) return;

  const missing: string[] = [];
  for (const relPath of SCAFFOLD_FILES) {
    writeIfMissing(relPath, defaultScaffoldContent(relPath));
    const tracked = tryGit(['ls-files', '--error-unmatch', '--', relPath]).ok;
    if (!tracked) missing.push(relPath);
  }

  if (missing.length === 0) return;
  runGit(['add', '--', ...missing]);
  const cached = runGit(['diff', '--cached', '--name-only']);
  if (!cached.trim()) return;

  const message = withSignoff([
    'chore(sentinel): track missing blog scaffold files',
    '',
    'Situation: Branch switching produced inconsistent runtime state because core scaffold files were present but not tracked in git.',
    'Task: Ensure base blog app files are tracked so checkout reflects complete branch content.',
    `Action: Added ${missing.length} missing scaffold files to git tracking (${missing.join(', ')}).`,
    'Result: Switching between branches now preserves a runnable blog structure without import resolution errors.',
  ].join('\n'));

  const msgFile = path.join(BLOG_DIR, '.git', 'SENTINEL_SCAFFOLD_MSG');
  fs.writeFileSync(msgFile, message, 'utf-8');
  runGit(['commit', '-F', msgFile]);
  fs.unlinkSync(msgFile);
}

function ensureGitRepo(): void {
  if (!fs.existsSync(path.join(BLOG_DIR, '.git'))) {
    runGit(['init']);
  }

  runGit(['config', 'user.email', 'sentinel@local']);
  runGit(['config', 'user.name', 'The Sentinel App']);

  const gitignorePath = path.join(BLOG_DIR, '.gitignore');
  const defaults = ['node_modules/', 'dist/', '.DS_Store'];
  const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';
  const merged = [...new Set([...existing.split('\n').filter(Boolean), ...defaults])].join('\n') + '\n';
  if (existing !== merged) {
    fs.writeFileSync(gitignorePath, merged, 'utf-8');
  }

  const hasHead = tryGit(['rev-parse', '--verify', 'HEAD']).ok;
  if (!hasHead) {
    runGit(['add', '-A']);
    const pending = runGit(['status', '--porcelain']);
    if (pending.trim()) {
      runGit(['commit', '-m', `chore(sentinel): bootstrap testbench blog repository\n\n${SIGNED_OFF_BY}`]);
    }
  }

  ensureTrackedScaffoldFiles();
}

function listBlogFiles(): string[] {
  const out: string[] = [];

  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(full);
    }
  };

  walk(BLOG_DIR);
  return out.sort((a, b) => a.localeCompare(b));
}

export function readBlogWorkspaceFiles(): Record<string, string> {
  ensureGitRepo();
  const files: Record<string, string> = {};
  for (const full of listBlogFiles()) {
    const rel = path.relative(ROOT_DIR, full).replace(/\\/g, '/');
    if (fs.statSync(full).size > 1_000_000) continue;
    files[rel] = fs.readFileSync(full, 'utf-8');
  }
  return files;
}

function toBlogRelativePath(filePath: string): string {
  if (!filePath.startsWith('testbench/blog/')) {
    throw new Error('Only files under testbench/blog are writable.');
  }
  const rel = filePath.replace('testbench/blog/', '');
  if (rel.includes('..')) throw new Error('Invalid file path');
  return rel;
}

function makeHash(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash.toString(16).slice(0, 7).padEnd(7, '0');
}

function sanitizeBranchSlug(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join('-')
    .replace(/-+/g, '-');
}

function buildBranchName(prompt: string): string {
  const slug = sanitizeBranchSlug(prompt) || 'task-update';
  return `sentinel/task-${slug}-${makeHash(prompt + Date.now().toString()).slice(0, 6)}`;
}

function readIfExists(fullPath: string): string {
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf-8');
}

function buildPlanningContext(): Record<string, string> {
  const files = readBlogWorkspaceFiles();
  const entries = Object.entries(files)
    .filter(([filePath]) => filePath.startsWith('testbench/blog/'))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 80);

  const context: Record<string, string> = {};
  for (const [filePath, content] of entries) {
    const relPath = filePath.replace('testbench/blog/', '');
    context[relPath] = content.length > 700 ? `${content.slice(0, 700)}\n...` : content;
  }
  return context;
}

function normalizeOperation(raw: Operation): Operation {
  const relPath = raw.relPath
    .replace(/^\/+/, '')
    .replace(/^testbench\/blog\//, '')
    .replace(/\\/g, '/')
    .trim();
  if (!relPath || relPath.includes('..')) throw new Error(`Invalid operation path: ${raw.relPath}`);
  if (raw.kind !== 'write' && raw.kind !== 'delete') throw new Error(`Invalid operation kind: ${raw.kind}`);
  return {
    relPath,
    kind: raw.kind,
    goal: raw.goal?.trim() || `Update ${relPath}`,
    newContent: raw.kind === 'write' && typeof raw.newContent === 'string'
      ? String(raw.newContent)
      : undefined,
  };
}

function isProtectedPath(relPath: string): boolean {
  if (PROTECTED_PATHS.has(relPath)) return true;
  return PROTECTED_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

function isSecretPath(relPath: string): boolean {
  return SECRET_PATH_PATTERNS.some((pattern) => pattern.test(relPath));
}

function validatePlannedPath(relPath: string): void {
  if (isProtectedPath(relPath)) {
    throw new Error(`Planned change targets protected path: ${relPath}`);
  }
  if (isSecretPath(relPath)) {
    throw new Error(`Blocked by Sentinel MCP: writing secrets file path requires secure env-var flow (${relPath}).`);
  }
}

function planOperations(prompt: string): Operation[] {
  const planningContext = buildPlanningContext();
  const generated = generateTaskOperationsWithCodex(prompt, planningContext);
  if (!generated || generated.length === 0) return [];

  const normalized = generated.map((op) => normalizeOperation({
    relPath: op.relPath,
    kind: op.kind,
    goal: op.goal,
    newContent: op.newContent,
  }));

  for (const op of normalized) {
    validatePlannedPath(op.relPath);
    if (op.kind === 'write' && typeof op.newContent !== 'string') {
      const fullPath = path.join(BLOG_DIR, op.relPath);
      const current = readIfExists(fullPath);
      const generatedContent = generateFileContentWithCodex(op.relPath, `${prompt}\n\nOperation goal: ${op.goal}`, current || undefined);
      if (!generatedContent) {
        throw new Error(`Unable to generate content for write operation: ${op.relPath}`);
      }
      op.newContent = generatedContent;
    }
  }

  return normalized;
}

function writeOperation(operation: Operation): void {
  const fullPath = path.join(BLOG_DIR, operation.relPath);
  if (operation.kind === 'delete') {
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    return;
  }
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, operation.newContent ?? '', 'utf-8');
}

function withSignoff(message: string): string {
  const trimmed = message.trim();
  if (trimmed.includes(SIGNED_OFF_BY)) return trimmed;
  return `${trimmed}\n\n${SIGNED_OFF_BY}`;
}

function isValidStarMessage(message: string, mustIncludePath: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (!text.includes('Situation:') || !text.includes('Task:') || !text.includes('Action:') || !text.includes('Result:')) {
    return false;
  }
  return text.includes(mustIncludePath);
}

function starMessage(relPath: string, goal: string, diff: string, kind: 'write' | 'delete'): string {
  const added = diff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++')).length;
  const removed = diff.split('\n').filter((line) => line.startsWith('-') && !line.startsWith('---')).length;
  const verb = kind === 'delete' ? 'remove' : 'update';
  const displayPath = `testbench/blog/${relPath}`;

  const codexMessage = generateStarCommitMessageWithCodex(displayPath, diff);
  if (codexMessage && isValidStarMessage(codexMessage, displayPath)) {
    return withSignoff(codexMessage);
  }

  return withSignoff([
    `chore(sentinel): ${verb} ${displayPath}`,
    '',
    `Situation: The requested task required isolated changes in ${displayPath} for safe incremental delivery.`,
    `Task: ${goal}.`,
    `Action: Applied an atomic file-level change based on git diff analysis (${added} additions, ${removed} deletions).`,
    `Result: ${displayPath} now reflects the requested behavior and can be reviewed independently.`,
  ].join('\n'));
}

function checkoutBranch(branch: string): void {
  runGit(['checkout', branch]);
}

function listLocalBranches(): string[] {
  const raw = runGit(['for-each-ref', '--format=%(refname:short)', 'refs/heads']);
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function branchExists(branch: string): boolean {
  if (!branch) return false;
  return listLocalBranches().includes(branch);
}

function resolveFallbackBranch(preferred?: string, exclude?: string): string {
  const branches = listLocalBranches();

  if (preferred && branches.includes(preferred) && preferred !== exclude) {
    return preferred;
  }

  const state = getGitState();
  if (!state.detached && state.current_branch && state.current_branch !== exclude && branches.includes(state.current_branch)) {
    return state.current_branch;
  }

  const common = ['main', 'master', 'develop'];
  for (const name of common) {
    if (branches.includes(name) && name !== exclude) return name;
  }

  const candidate = branches.find((name) => name !== exclude);
  if (candidate) return candidate;

  throw new Error('No suitable target branch found.');
}

function checkoutNewBranch(branch: string): void {
  try {
    runGit(['checkout', '-b', branch]);
  } catch {
    runGit(['checkout', branch]);
  }
}

function parseGitLog(raw: string): ApiCommit[] {
  if (!raw.trim()) return [];
  return raw
    .split('\x1e')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, index) => {
      const [fullHash, shortHash, author, isoDate, ...messageParts] = chunk.split('\x1f');
      const message = (messageParts.join('\x1f') || '').trim();
      const filesRaw = runGit(['show', '--pretty=format:', '--name-only', fullHash]);
      const files = filesRaw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `testbench/blog/${line.replace(/\\/g, '/')}`);
      const diff = runGit(['show', '--pretty=format:', '--unified=3', fullHash]);
      return {
        id: `${fullHash}-${index}`,
        hash: shortHash,
        author: author || 'The Sentinel',
        date: isoDate || 'just now',
        message,
        diff,
        files,
      };
    });
}

export function getCommitsForBranch(branch: string, limit = 25): ApiCommit[] {
  ensureGitRepo();
  const raw = runGit(['log', branch, '--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%B%x1e', '--date=iso', '-n', String(limit)]);
  return parseGitLog(raw);
}

function getCommitsInRange(baseRef: string, headRef: string, limit = 50): ApiCommit[] {
  const raw = runGit([
    'log',
    `${baseRef}..${headRef}`,
    '--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%B%x1e',
    '--date=iso',
    '-n',
    String(limit),
  ]);
  return parseGitLog(raw);
}

export function getAllBranchesSorted(limit = 25): Record<string, ApiCommit[]> {
  ensureGitRepo();
  const raw = runGit(['for-each-ref', '--sort=-committerdate', '--format=%(refname:short)', 'refs/heads']);
  const branches = raw.split('\n').map((line) => line.trim()).filter(Boolean);

  const output: Record<string, ApiCommit[]> = {};
  branches.forEach((branch) => {
    output[branch] = getCommitsForBranch(branch, limit);
  });
  return output;
}

export function getGitState(): GitState {
  ensureGitRepo();
  const branchOrHead = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  const detached = branchOrHead === 'HEAD';
  return {
    current_branch: detached ? '(detached)' : branchOrHead,
    detached,
    head_hash: runGit(['rev-parse', '--short', 'HEAD']),
    pending_changes: runGit(['status', '--porcelain']).trim().length > 0,
  };
}

export function saveBlogFile(filePath: string, content: string): Record<string, string> {
  ensureGitRepo();
  const relPath = toBlogRelativePath(filePath);
  const full = path.join(BLOG_DIR, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
  return readBlogWorkspaceFiles();
}

export function commitHumanFile(filePath: string, goal: string): { commit: ApiCommit; state: GitState; files: Record<string, string> } {
  ensureGitRepo();
  const relPath = toBlogRelativePath(filePath);

  runGit(['add', '--', relPath]);
  const cachedDiff = runGit(['diff', '--cached', '--', relPath]);
  if (!cachedDiff.trim()) {
    throw new Error('No staged changes detected for this file.');
  }

  const added = cachedDiff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++')).length;
  const removed = cachedDiff.split('\n').filter((line) => line.startsWith('-') && !line.startsWith('---')).length;
  const codexMessage = generateStarCommitMessageWithCodex(filePath, cachedDiff);

  const fallbackMessage = [
    `chore(human): update ${filePath}`,
    '',
    `Situation: A human intervention changed ${filePath} and requires an auditable commit.`,
    `Task: ${goal || `Commit human-authored changes in ${filePath}`}.`,
    `Action: Staged ${filePath} and generated an atomic commit from git diff analysis (${added} additions, ${removed} deletions).`,
    `Result: Human changes are now preserved in branch history with a traceable STAR commit message.`,
  ].join('\n');
  const message = withSignoff(
    codexMessage && isValidStarMessage(codexMessage, filePath) ? codexMessage : fallbackMessage,
  );

  const msgFile = path.join(BLOG_DIR, '.git', 'SENTINEL_HUMAN_COMMIT_MSG');
  fs.writeFileSync(msgFile, message, 'utf-8');
  runGit(['commit', '-F', msgFile]);
  fs.unlinkSync(msgFile);

  const hash = runGit(['rev-parse', '--short', 'HEAD']);
  const fullMessage = runGit(['log', '-1', '--pretty=%B']);
  const diff = runGit(['show', '--pretty=format:', '--unified=3', 'HEAD', '--', relPath]);

  return {
    commit: {
      id: `${Date.now()}-human`,
      hash,
      author: 'Human Developer',
      date: 'just now',
      message: fullMessage,
      diff,
      files: [filePath],
    },
    state: getGitState(),
    files: readBlogWorkspaceFiles(),
  };
}

export function checkoutCommitSafely(commitHash: string): { state: GitState; files: Record<string, string>; stash_ref: string | null } {
  ensureGitRepo();

  let stashRef: string | null = null;
  const dirty = runGit(['status', '--porcelain']).trim().length > 0;
  if (dirty) {
    const marker = `sentinel-auto-stash-${Date.now()}`;
    runGit(['stash', 'push', '-u', '-m', marker]);
    const top = runGit(['stash', 'list', '-n', '1', '--format=%gd']);
    stashRef = top || 'stash@{0}';
  }

  runGit(['checkout', '--detach', commitHash]);
  return { state: getGitState(), files: readBlogWorkspaceFiles(), stash_ref: stashRef };
}

export function returnToBranchHead(branch: string, stashRef?: string): { state: GitState; files: Record<string, string> } {
  ensureGitRepo();
  checkoutBranch(branch);
  if (stashRef) {
    const applied = tryGit(['stash', 'pop', stashRef]);
    if (!applied.ok) {
      // Keep workflow non-fatal if stash has conflicts or already applied.
    }
  }
  return { state: getGitState(), files: readBlogWorkspaceFiles() };
}

export function revertCommit(commitHash: string): { state: GitState; files: Record<string, string>; commit: ApiCommit } {
  ensureGitRepo();
  runGit(['revert', '--no-edit', commitHash]);
  const hash = runGit(['rev-parse', '--short', 'HEAD']);
  const fullMessage = runGit(['log', '-1', '--pretty=%B']);
  const diff = runGit(['show', '--pretty=format:', '--unified=3', 'HEAD']);

  return {
    state: getGitState(),
    files: readBlogWorkspaceFiles(),
    commit: {
      id: `${Date.now()}-revert`,
      hash,
      author: 'The Sentinel App',
      date: 'just now',
      message: fullMessage,
      diff,
      files: [],
    },
  };
}

export function mergeBranch(sourceBranch: string, targetBranch: string): { state: GitState; files: Record<string, string> } {
  ensureGitRepo();
  if (!sourceBranch || !targetBranch) {
    throw new Error('Both sourceBranch and targetBranch are required for merge.');
  }
  if (!branchExists(targetBranch)) {
    throw new Error(`Target branch does not exist: ${targetBranch}`);
  }
  const resolvedTarget = targetBranch;
  if (!branchExists(sourceBranch)) {
    throw new Error(`Source branch does not exist: ${sourceBranch}`);
  }
  if (sourceBranch === resolvedTarget) throw new Error('Source and target branches must be different.');

  let stashRef: string | null = null;
  const dirty = runGit(['status', '--porcelain']).trim().length > 0;
  if (dirty) {
    const marker = `sentinel-merge-stash-${Date.now()}`;
    runGit(['stash', 'push', '-u', '-m', marker]);
    stashRef = runGit(['stash', 'list', '-n', '1', '--format=%gd']) || 'stash@{0}';
  }

  checkoutBranch(resolvedTarget);
  runGit(['merge', '--no-ff', '--signoff', sourceBranch, '-m', `chore(merge): merge ${sourceBranch} into ${resolvedTarget}`]);

  if (stashRef) {
    const popped = tryGit(['stash', 'pop', stashRef]);
    if (!popped.ok) {
      // Keep non-fatal to avoid hiding successful merge due to stash conflicts.
    }
  }

  return { state: getGitState(), files: readBlogWorkspaceFiles() };
}

export function deleteBranch(branch: string, fallbackBranch = ''): { state: GitState; files: Record<string, string> } {
  ensureGitRepo();
  const state = getGitState();
  if (!state.detached && state.current_branch === branch) {
    const resolved = resolveFallbackBranch(fallbackBranch, branch);
    checkoutBranch(resolved);
  }
  runGit(['branch', '-D', branch]);
  return { state: getGitState(), files: readBlogWorkspaceFiles() };
}

export function discardBranch(branch: string, fallbackBranch = ''): { state: GitState; files: Record<string, string> } {
  return deleteBranch(branch, fallbackBranch);
}

export function resetSandbox(): { state: GitState; files: Record<string, string>; base_branch: string } {
  ensureGitRepo();

  const baseBranch = resolveFallbackBranch('main');
  checkoutBranch(baseBranch);
  runGit(['reset', '--hard', 'HEAD']);
  runGit(['clean', '-fd']);

  return {
    state: getGitState(),
    files: readBlogWorkspaceFiles(),
    base_branch: baseBranch,
  };
}

export function runAgentTask(prompt: string, allowDestructive = false): AgentTaskResponse {
  ensureGitRepo();
  const lowerPrompt = prompt.toLowerCase();
  const stateBefore = getGitState();
  const baseBranchBefore = !stateBefore.detached && stateBefore.current_branch ? stateBefore.current_branch : '';
  if (stateBefore.detached) {
    const resumeBranch = resolveFallbackBranch(undefined);
    checkoutBranch(resumeBranch);
  }

  const operations = planOperations(prompt);
  if (operations.length === 0) {
    const looksLikeSecretExposure =
      (lowerPrompt.includes('config.py') || lowerPrompt.includes('.env'))
      && (
        lowerPrompt.includes('credential')
        || lowerPrompt.includes('password')
        || lowerPrompt.includes('db_pass')
        || lowerPrompt.includes('api key')
        || lowerPrompt.includes('token')
        || lowerPrompt.includes('secret')
      );
    if (looksLikeSecretExposure) {
      throw new Error('Blocked by Sentinel MCP: secret exposure attempt detected in config/.env workflow. Use environment variables instead.');
    }
    const plannerError = getLastPlannerError();
    if (plannerError) {
      throw new Error(`Planner returned no valid operations. Root cause: ${plannerError}`);
    }
    throw new Error('Planner returned no valid operations. Rephrase with explicit target files/behavior (for example: update src/App.jsx and src/styles.css to add dark/light toggle).');
  }
  const destructiveTargets = operations
    .filter((op) => op.kind === 'delete')
    .map((op) => op.relPath);
  if (destructiveTargets.length > 0 && !allowDestructive) {
    throw new Error(
      `Blocked by Sentinel MCP: destructive delete operations require explicit approval (${destructiveTargets.join(', ')}).`,
    );
  }

  const branch = buildBranchName(prompt);
  checkoutNewBranch(branch);
  const commits: ApiCommit[] = [];
  const stagedBefore = runGit(['diff', '--cached', '--name-only']);
  if (stagedBefore.trim()) {
    throw new Error('Refusing to run task with pre-staged changes. Please clear index before running agent tasks.');
  }

  operations.forEach((operation, index) => {
    writeOperation(operation);
    runGit(['add', '-A', '--', operation.relPath]);
    const stagedNow = runGit(['diff', '--cached', '--name-only'])
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const unexpected = stagedNow.filter((file) => file !== operation.relPath);
    if (unexpected.length > 0) {
      throw new Error(`Staged drift detected for ${operation.relPath}. Unexpected staged files: ${unexpected.join(', ')}`);
    }

    const cachedDiff = runGit(['diff', '--cached', '--', operation.relPath]);
    if (!cachedDiff.trim()) return;

    const message = starMessage(operation.relPath, operation.goal, cachedDiff, operation.kind);
    const msgFile = path.join(BLOG_DIR, '.git', 'SENTINEL_COMMIT_MSG');
    fs.writeFileSync(msgFile, message, 'utf-8');
    runGit(['commit', '-F', msgFile]);
    fs.unlinkSync(msgFile);

    const hash = runGit(['rev-parse', '--short', 'HEAD']);
    const fullMessage = runGit(['log', '-1', '--pretty=%B']);
    const diff = runGit(['show', '--pretty=format:', '--unified=3', 'HEAD', '--', operation.relPath]);

    commits.push({
      id: `${Date.now()}-${index}`,
      hash,
      author: 'The Sentinel App',
      date: 'just now',
      message: fullMessage,
      diff,
      files: [`testbench/blog/${operation.relPath.replace(/\\/g, '/')}`],
    });
  });

  const baseBranch = baseBranchBefore || resolveFallbackBranch(undefined, branch);
  const rangeRef = branchExists(baseBranch) ? `${baseBranch}..${branch}` : branch;
  const rangeTree = runGit(['log', '--graph', '--oneline', rangeRef]);
  const scopedCommits = branchExists(baseBranch) ? getCommitsInRange(baseBranch, branch) : commits;

  return {
    branch,
    commits,
    branch_commits: scopedCommits,
    total_commits: commits.length,
    git_tree: rangeTree || runGit(['log', '--graph', '--oneline', '-n', '25']),
    files: readBlogWorkspaceFiles(),
    state: getGitState(),
  };
}
