import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { generateStarCommitMessageWithCodex } from './codexBridge';

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
const POSTS_DIR = path.resolve(BLOG_DIR, 'database/posts');
const DEFAULT_DATE = '2026-03-01';
const SIGNED_OFF_BY = 'Signed-off-by: The Sentinel App <sentinel@local>';
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

function titleToSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

function extractQuotedTitle(prompt: string): string | null {
  const titled = prompt.match(/titled?\s*[:\-]?\s*["']([^"']+)["']/i);
  if (titled?.[1]) return titled[1].trim();

  const parts = [...prompt.matchAll(/["']([^"']+)["']/g)].map((m) => m[1].trim()).filter(Boolean);
  if (parts.length > 0) return parts.sort((a, b) => b.length - a.length)[0];
  return null;
}

function nextPostNumber(): number {
  const files = fs.readdirSync(POSTS_DIR).filter((n) => n.endsWith('.md'));
  const nums = files.map((n) => n.match(/^(\d+)-/)?.[1]).filter(Boolean).map((n) => Number(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function createPostContent(id: string, title: string): string {
  return `---\nid: ${id}\ntitle: ${title}\nauthor: The Sentinel\npublishedAt: ${DEFAULT_DATE}\ntags: update, agent\n---\nThis post was created automatically from an agent task request.\n\nUse this entry to verify branch, commit, and STAR message workflows.\n`;
}

function createTimelinePostContent(id: string, title: string, year: number): string {
  return `---\nid: ${id}\ntitle: ${title}\nauthor: The Sentinel\npublishedAt: ${year}-01-15\ntags: timeline, generated\n---\nThis timeline entry covers year ${year} for the generated blog post sequence.\n\nIt was created automatically from a range-based task request and is intended for deterministic testing.\n`;
}

function appendTaskLog(oldContent: string, prompt: string): string {
  const marker = '## Task Log';
  const entry = `- ${DEFAULT_DATE}: ${prompt}`;
  if (oldContent.includes(marker)) return `${oldContent.trimEnd()}\n${entry}\n`;
  return `${oldContent.trimEnd()}\n\n${marker}\n\n${entry}\n`;
}

function buildThemeEnabledAppJsx(current: string): string {
  if (current.includes('theme-toggle')) return current;

  let next = current;
  next = next.replace(
    "import { useMemo, useState } from 'react';",
    "import { useEffect, useMemo, useState } from 'react';",
  );

  next = next.replace(
    '  const [selectedPostId, setSelectedPostId] = useState(posts[0]?.id ?? null);\n\n  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null;\n',
    "  const [selectedPostId, setSelectedPostId] = useState(posts[0]?.id ?? null);\n  const [theme, setTheme] = useState(() => localStorage.getItem('blog-theme') || 'light');\n\n  useEffect(() => {\n    document.documentElement.setAttribute('data-theme', theme);\n    localStorage.setItem('blog-theme', theme);\n  }, [theme]);\n\n  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null;\n",
  );

  next = next.replace(
    '      <header className="header">\n        <h1>Mini Blog Testbench</h1>\n        <p>Simple React blog for agent testing.</p>\n      </header>\n',
    '      <header className="header">\n        <div className="header-top">\n          <div>\n            <h1>Mini Blog Testbench</h1>\n            <p>Simple React blog for agent testing.</p>\n          </div>\n          <button\n            type="button"\n            className="theme-toggle"\n            onClick={() => setTheme((prev) => (prev === \'dark\' ? \'light\' : \'dark\'))}\n          >\n            {theme === \'dark\' ? \'Switch to Light\' : \'Switch to Dark\'}\n          </button>\n        </div>\n      </header>\n',
  );

  return next;
}

function buildThemeEnabledStylesCss(current: string): string {
  let next = current;
  const rootBlock = [
    ':root {',
    '  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;',
    '  --bg: #f8fafc;',
    '  --text: #1f2937;',
    '  --muted: #4b5563;',
    '  --panel: #ffffff;',
    '  --border: #e5e7eb;',
    '  --active-bg: #eff6ff;',
    '  --active-border: #2563eb;',
    '  --button-bg: #111827;',
    '  --button-text: #f9fafb;',
    '  color: var(--text);',
    '  background: var(--bg);',
    '}',
    '',
    '[data-theme="dark"] {',
    '  --bg: #0b1220;',
    '  --text: #e5e7eb;',
    '  --muted: #9ca3af;',
    '  --panel: #111827;',
    '  --border: #374151;',
    '  --active-bg: #1f2937;',
    '  --active-border: #60a5fa;',
    '  --button-bg: #f9fafb;',
    '  --button-text: #111827;',
    '}',
  ].join('\n');

  next = next.replace(
    /:root\s*\{[\s\S]*?\}/,
    rootBlock,
  );

  next = next.replace('  margin: 0;\n', '  margin: 0;\n  background: var(--bg);\n  color: var(--text);\n');
  next = next.replace('.header {\n  margin-bottom: 20px;\n}\n', '.header {\n  margin-bottom: 20px;\n}\n\n.header-top {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n}\n');
  if (!next.includes('.theme-toggle {')) {
    next += '\n.theme-toggle {\n  border: 1px solid var(--border);\n  background: var(--button-bg);\n  color: var(--button-text);\n  border-radius: 8px;\n  padding: 8px 12px;\n  cursor: pointer;\n}\n\n.theme-toggle:hover {\n  opacity: 0.9;\n}\n';
  }
  next = next.replace('  color: #4b5563;\n', '  color: var(--muted);\n');
  next = next.replace('  background: #ffffff;\n', '  background: var(--panel);\n');
  next = next.replace('  border: 1px solid #e5e7eb;\n', '  border: 1px solid var(--border);\n');
  next = next.replace('  background: #ffffff;\n', '  background: var(--panel);\n');
  next = next.replace('  border: 1px solid #e5e7eb;\n', '  border: 1px solid var(--border);\n');
  next = next.replace('  border-color: #2563eb;\n  background: #eff6ff;\n', '  border-color: var(--active-border);\n  background: var(--active-bg);\n');
  next = next.replace('  color: #6b7280;\n', '  color: var(--muted);\n');
  return next;
}

function splitFrontMatter(markdown: string): { frontMatter: string; body: string } {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { frontMatter: '', body: markdown.trim() };
  return { frontMatter: match[1].trim(), body: markdown.slice(match[0].length).trim() };
}

function buildPostBodyFromPrompt(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes('taylor swift')) {
    return [
      'The story follows a songwriter who keeps turning heartbreak into melodies and courage.',
      'Each chapter moves from quiet small-town dreams to bright stadium nights, where love feels huge and fragile at the same time.',
      'She meets different partners, learns from each relationship, and writes with honesty about longing, growth, and choosing herself.',
      'In the end, the post frames love as an evolving journey: part fairy tale, part hard lesson, and always transformed into art.',
    ].join('\n\n');
  }

  if (lower.includes('random content')) {
    return [
      'A chance meeting at a train platform started this chapter with surprise and laughter.',
      'From there, the story wandered through late-night calls, weekend trips, and honest conversations.',
      'What mattered most was not the perfect ending, but the way both people grew through the experience.',
    ].join('\n\n');
  }

  return [
    'This post was edited by The Sentinel according to the task request.',
    'The body content has been replaced so the requested narrative is now reflected directly in the markdown file.',
  ].join('\n\n');
}

function resolvePostFileFromPrompt(prompt: string): string | null {
  const explicit = prompt.match(/([0-9]{3}-[a-z0-9-]+\.md)/i)?.[1];
  if (explicit) return `database/posts/${explicit}`;

  const titled = extractQuotedTitle(prompt);
  if (!titled) return null;

  const slug = titleToSlug(titled);
  const candidate = fs.readdirSync(POSTS_DIR).find((n) => n.endsWith('.md') && n.toLowerCase().includes(slug));
  return candidate ? `database/posts/${candidate}` : null;
}

function readIfExists(fullPath: string): string {
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf-8');
}

function parseRangePrompt(promptLower: string): { start: number; end: number; yearFrom: number; yearTo: number } | null {
  const postRange = promptLower.match(/posts?\s+(\d{1,3})\s*(?:to|-|through)\s*(\d{1,3})/);
  const yearRange = promptLower.match(/(?:time|year|years?)\s*(?:from)?\s*(\d{4})\s*(?:to|-|through)\s*(\d{4})/);
  if (!postRange || !yearRange) return null;

  const start = Number(postRange[1]);
  const end = Number(postRange[2]);
  const yearFrom = Number(yearRange[1]);
  const yearTo = Number(yearRange[2]);

  if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(yearFrom) || Number.isNaN(yearTo)) return null;
  if (end < start || yearTo < yearFrom) return null;
  return { start, end, yearFrom, yearTo };
}

function planOperations(prompt: string): Operation[] {
  const operations: Operation[] = [];
  const lower = prompt.toLowerCase();
  const range = parseRangePrompt(lower);

  const wantsNewPost = /(create|add|write|draft).*(new\s+)?(blog\s+)?posts?\b/.test(lower) || /(new\s+blog\s+posts?\b)/.test(lower);
  const wantsEditPost = /(edit|update|rewrite|modify).*(posts?\b|\.md)/.test(lower);
  const deleteBeforeMatch = /delete\s+all\s+blog\s+posts\s+posted\s+before\s+(\d{4})/.exec(lower);
  const wantsUiFix = /(ui|style|css|layout)/.test(lower);
  const wantsThemeMode = (
    ((lower.includes('dark') && lower.includes('light')) || lower.includes('dark/light'))
    && (lower.includes('mode') || lower.includes('theme') || lower.includes('toggle'))
  );

  if (range) {
    const count = range.end - range.start + 1;
    const yearSpan = range.yearTo - range.yearFrom;
    for (let i = 0; i < count; i += 1) {
      const postNumber = range.start + i;
      const postId = String(postNumber).padStart(3, '0');
      const year = count > 1
        ? Math.round(range.yearFrom + (yearSpan * i) / (count - 1))
        : range.yearFrom;
      const relPath = `database/posts/${postId}-timeline-${year}.md`;
      const title = `Timeline ${year}`;
      operations.push({
        relPath,
        goal: `Create timeline post ${postId} for year ${year}`,
        kind: 'write',
        newContent: createTimelinePostContent(`${postId}-timeline-${year}`, title, year),
      });
    }
    return operations;
  }

  if (wantsThemeMode) {
    const appRelPath = 'src/App.jsx';
    const appOld = readIfExists(path.join(BLOG_DIR, appRelPath));
    if (appOld) {
      const appNew = buildThemeEnabledAppJsx(appOld);
      if (appNew !== appOld) {
        operations.push({
          relPath: appRelPath,
          goal: 'Add dark/light theme toggle button in blog app header',
          kind: 'write',
          newContent: appNew,
        });
      }
    }

    const cssRelPath = 'src/styles.css';
    const cssOld = readIfExists(path.join(BLOG_DIR, cssRelPath));
    if (cssOld) {
      const cssNew = buildThemeEnabledStylesCss(cssOld);
      if (cssNew !== cssOld) {
        operations.push({
          relPath: cssRelPath,
          goal: 'Add dark/light theme CSS variables and toggle styles',
          kind: 'write',
          newContent: cssNew,
        });
      }
    }

    return operations;
  }

  if (wantsNewPost) {
    const number = nextPostNumber();
    const title = extractQuotedTitle(prompt) || `Agent Post ${number.toString().padStart(3, '0')}`;
    const slug = titleToSlug(title) || `post-${number}`;
    const id = `${number.toString().padStart(3, '0')}-${slug}`;
    operations.push({
      relPath: `database/posts/${id}.md`,
      goal: `Create a new blog post titled "${title}"`,
      kind: 'write',
      newContent: createPostContent(id, title),
    });
  }

  if (deleteBeforeMatch) {
    const thresholdYear = Number(deleteBeforeMatch[1]);
    for (const postName of fs.readdirSync(POSTS_DIR).filter((n) => n.endsWith('.md'))) {
      const postPath = path.join(POSTS_DIR, postName);
      const content = fs.readFileSync(postPath, 'utf-8');
      const year = Number(content.match(/publishedAt:\s*(\d{4})-/)?.[1] || 9999);
      if (year < thresholdYear) {
        operations.push({ relPath: `database/posts/${postName}`, goal: `Delete post fixture published before ${thresholdYear}`, kind: 'delete' });
      }
    }
  }

  if (wantsUiFix) {
    const relPath = 'src/styles.css';
    const oldContent = readIfExists(path.join(BLOG_DIR, relPath));
    if (!oldContent.includes('Sentinel UI fix')) {
      operations.push({
        relPath,
        goal: 'Improve blog UI accessibility focus states',
        kind: 'write',
        newContent: `${oldContent.trimEnd()}\n\n/* Sentinel UI fix */\n.post-item:focus-visible {\n  outline: 2px solid #10b981;\n  outline-offset: 2px;\n}\n`,
      });
    }
  }

  if (wantsEditPost) {
    const relPath = resolvePostFileFromPrompt(prompt);
    if (relPath) {
      const oldContent = readIfExists(path.join(BLOG_DIR, relPath));
      if (oldContent) {
        const { frontMatter } = splitFrontMatter(oldContent);
        const updatedBody = buildPostBodyFromPrompt(prompt);
        const rebuilt = frontMatter ? `---\n${frontMatter}\n---\n${updatedBody}\n` : `${updatedBody}\n`;
        operations.push({
          relPath,
          goal: `Update ${relPath} content based on prompt instructions`,
          kind: 'write',
          newContent: rebuilt,
        });
      }
    }
  }

  return operations;
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

export function runAgentTask(prompt: string): AgentTaskResponse {
  ensureGitRepo();
  const stateBefore = getGitState();
  const baseBranchBefore = !stateBefore.detached && stateBefore.current_branch ? stateBefore.current_branch : '';
  if (stateBefore.detached) {
    const resumeBranch = resolveFallbackBranch(undefined);
    checkoutBranch(resumeBranch);
  }

  const operations = planOperations(prompt);
  if (operations.length === 0) {
    throw new Error('No actionable code/database changes could be derived from this prompt. No commit was created.');
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
