import { execFileSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

const ROOT_DIR = process.cwd();
dotenv.config({ path: path.resolve(ROOT_DIR, '.env.local') });
dotenv.config({ path: path.resolve(ROOT_DIR, '.env') });

export type RuntimeStatus = {
  mode: 'codex_mcp' | 'local_fallback';
  available: boolean;
  reason: string;
};

let runtimeCache: RuntimeStatus | null = null;

function getOpenAiConfig(): { apiKey: string; model: string } | null {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return null;
  const model = String(process.env.OPENAI_MODEL || 'codex-latest').trim();
  return { apiKey, model };
}

function extractResponseText(payload: any): string {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const output = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      if (typeof block?.text === 'string' && block.text.trim()) {
        return block.text.trim();
      }
    }
  }
  return '';
}

export function getRuntimeStatus(): RuntimeStatus {
  if (runtimeCache) return runtimeCache;

  const cfg = getOpenAiConfig();
  if (!cfg) {
    runtimeCache = {
      mode: 'local_fallback',
      available: false,
      reason: 'OPENAI_API_KEY is missing. Set it in .env.local to enable Codex/OpenAI generation.',
    };
    return runtimeCache;
  }

  runtimeCache = {
    mode: 'codex_mcp',
    available: true,
    reason: `OpenAI API runtime is enabled with model "${cfg.model}".`,
  };
  return runtimeCache;
}

export function generateStarCommitMessageWithCodex(filePath: string, diff: string): string | null {
  const cfg = getOpenAiConfig();
  if (!cfg) return null;

  const prompt = [
    'Generate a git commit message using STAR format.',
    'Use this exact format:',
    `chore(sentinel): update ${filePath}`,
    '',
    'Situation: ...',
    'Task: ...',
    'Action: ...',
    'Result: ...',
    '',
    'Keep it concise and specific to the diff.',
    '',
    `File: ${filePath}`,
    'Diff:',
    diff,
  ].join('\n');

  const body = JSON.stringify({
    model: cfg.model,
    input: prompt,
    max_output_tokens: 280,
  });

  try {
    const raw = execFileSync(
      'curl',
      [
        '-sS',
        'https://api.openai.com/v1/responses',
        '-H',
        `Authorization: Bearer ${cfg.apiKey}`,
        '-H',
        'Content-Type: application/json',
        '-d',
        body,
      ],
      { cwd: ROOT_DIR, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();

    const parsed = JSON.parse(raw);
    const text = extractResponseText(parsed);
    return text || null;
  } catch {
    return null;
  }
}
