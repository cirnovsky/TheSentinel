import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import {
  checkoutCommitSafely,
  commitHumanFile,
  deleteBranch,
  discardBranch,
  getAllBranchesSorted,
  getGitState,
  mergeBranch,
  readBlogWorkspaceFiles,
  resetSandbox,
  returnToBranchHead,
  revertCommit,
  runAgentTask,
  saveBlogFile,
} from './server/gitAgent';
import { getRuntimeStatus } from './server/codexBridge';

function readBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function sentinelApiPlugin(): Plugin {
  const attach = (middlewares: {use: (path: string, handler: (req: any, res: any) => void) => void}) => {
    middlewares.use('/api/testbench/files', (_req, res) => {
      try {
        const files = readBlogWorkspaceFiles();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({files}));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({error: String(error)}));
      }
    });

    middlewares.use('/api/agent/branches', (_req, res) => {
      try {
        const branches = getAllBranchesSorted();
        const state = getGitState();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({branches, state}));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({error: String(error)}));
      }
    });

    middlewares.use('/api/runtime/status', (_req, res) => {
      try {
        const runtime = getRuntimeStatus();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(runtime));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String(error) }));
      }
    });

    middlewares.use('/api/agent/task', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }

      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const prompt = String(body.prompt || '').trim();
        const allowDestructive = Boolean(body.allow_destructive);
        if (!prompt) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({error: 'prompt is required'}));
          return;
        }

        const result = runAgentTask(prompt, allowDestructive);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({error: String(error)}));
      }
    });

    middlewares.use('/api/reset-sandbox', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }

      try {
        const result = resetSandbox();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String(error) }));
      }
    });

    middlewares.use('/api/file/save', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const filePath = String(body.filePath || '').trim();
        const content = String(body.content ?? '');
        const files = saveBlogFile(filePath, content);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({files, state: getGitState()}));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({error: String(error)}));
      }
    });

    middlewares.use('/api/git/commit-human', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const filePath = String(body.filePath || '').trim();
        const goal = String(body.goal || '').trim();
        const result = commitHumanFile(filePath, goal);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({error: String(error)}));
      }
    });

    middlewares.use('/api/git/checkout-commit', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const commitHash = String(body.commitHash || '').trim();
        const result = checkoutCommitSafely(commitHash);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({error: String(error)}));
      }
    });

    middlewares.use('/api/git/return-head', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const branch = String(body.branch || 'main').trim();
        const stashRef = body.stashRef ? String(body.stashRef) : undefined;
        const result = returnToBranchHead(branch, stashRef);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({error: String(error)}));
      }
    });

    middlewares.use('/api/git/revert', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const commitHash = String(body.commitHash || '').trim();
        const result = revertCommit(commitHash);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({error: String(error)}));
      }
    });

    middlewares.use('/api/git/merge', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const sourceBranch = String(body.sourceBranch || '').trim();
        const targetBranch = String(body.targetBranch || '').trim();
        const result = mergeBranch(sourceBranch, targetBranch);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({error: String(error)}));
      }
    });

    middlewares.use('/api/git/delete-branch', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const branch = String(body.branch || '').trim();
        const fallbackBranch = String(body.fallbackBranch || 'main').trim();
        const result = deleteBranch(branch, fallbackBranch);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({error: String(error)}));
      }
    });

    middlewares.use('/api/git/discard-branch', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const branch = String(body.branch || '').trim();
        const fallbackBranch = String(body.fallbackBranch || 'main').trim();
        const result = discardBranch(branch, fallbackBranch);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({error: String(error)}));
      }
    });
  };

  return {
    name: 'sentinel-api',
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), sentinelApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Set DISABLE_HMR=true to disable hot reload when needed.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
