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

export type CodexPlannedOperation = {
  relPath: string;
  kind: 'write' | 'delete';
  goal: string;
  newContent?: string;
};

let runtimeCache: RuntimeStatus | null = null;
let resolvedModelCache: string | null = null;

function getOpenAiConfig(): { apiKey: string; model: string } | null {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return null;
  const model = String(process.env.OPENAI_MODEL || 'codex-latest').trim();
  return { apiKey, model };
}

function candidateModels(requested: string): string[] {
  const ordered = [resolvedModelCache || '', requested, 'gpt-4.1', 'gpt-4o-mini'];
  return [...new Set(ordered.filter(Boolean))];
}

let lastPlannerError = '';
export function getLastPlannerError(): string {
  return lastPlannerError;
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

function callResponsesApi(apiKey: string, body: Record<string, unknown>): any | null {
  const baseUrl = String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const url = `${baseUrl}/responses`;
  const requestedModel = String(body.model || '');
  const models = requestedModel ? candidateModels(requestedModel) : ['gpt-4.1', 'gpt-4o-mini'];

  const modelErrors: string[] = [];
  for (const model of models) {
    try {
      const requestBody = { ...body, model };
      const raw = execFileSync(
        'curl',
        [
          '-sS',
          url,
          '-H',
          `Authorization: Bearer ${apiKey}`,
          '-H',
          'Content-Type: application/json',
          '-d',
          JSON.stringify(requestBody),
        ],
        { cwd: ROOT_DIR, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
      ).trim();
      const parsed = JSON.parse(raw);
      if (parsed?.error?.message) {
        const msg = String(parsed.error.message);
        const missingModel =
          msg.includes('does not exist')
          || msg.includes('not found')
          || msg.includes('invalid model')
          || msg.includes('not available')
          || msg.includes('unavailable');
        if (missingModel) {
          modelErrors.push(`${model}: ${msg}`);
          continue;
        }
        lastPlannerError = `OpenAI API error: ${msg}`;
        return null;
      }
      resolvedModelCache = model;
      return parsed;
    } catch (error) {
      const msg = String(error);
      if (msg.includes('Could not resolve host')) {
        lastPlannerError = 'Network/DNS error reaching OpenAI API (Could not resolve host).';
      } else {
        lastPlannerError = `Planner API call failed: ${msg.split('\n')[0]}`;
      }
      return null;
    }
  }
  if (modelErrors.length > 0) {
    lastPlannerError = `OpenAI API model unavailable. Tried: ${modelErrors.join(' | ')}`;
  }
  return null;
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf('{');
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = firstBrace; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return trimmed.slice(firstBrace, i + 1);
      }
    }
  }
  return null;
}

function parseOperationsFromText(text: string): CodexPlannedOperation[] | null {
  const jsonText = extractJsonObject(text) || text.trim();
  if (!jsonText) return null;
  try {
    const parsed = JSON.parse(jsonText) as any;
    if (Array.isArray(parsed)) return parsed as CodexPlannedOperation[];
    if (Array.isArray(parsed?.operations)) return parsed.operations as CodexPlannedOperation[];
    if (Array.isArray(parsed?.plan)) return parsed.plan as CodexPlannedOperation[];
    return null;
  } catch {
    return null;
  }
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

  const body = {
    model: cfg.model,
    input: prompt,
    max_output_tokens: 280,
  };

  const parsed = callResponsesApi(cfg.apiKey, body);
  if (!parsed) return null;
  const text = extractResponseText(parsed);
  return text || null;
}

export function generateTaskOperationsWithCodex(
  prompt: string,
  fileContext: Record<string, string>,
): CodexPlannedOperation[] | null {
  lastPlannerError = '';
  const cfg = getOpenAiConfig();
  if (!cfg) {
    lastPlannerError = 'OPENAI_API_KEY is missing.';
    return null;
  }

  const contextEntries = Object.entries(fileContext);
  const contextFull = Object.fromEntries(contextEntries);
  const contextCompact = Object.fromEntries(contextEntries.slice(0, 24));

  const requestPlan = (context: Record<string, string>): CodexPlannedOperation[] | null => {
    const promptText = [
      'Plan atomic file operations for a git-based coding agent.',
      'Only plan operations inside testbench/blog.',
      'Prioritize directly requested feature/file changes.',
      'For write operations, provide full file content in newContent.',
      'For delete operations, still provide newContent as an empty string.',
      'If task is unsafe/destructive, return operations as empty array.',
      '',
      `User prompt: ${prompt}`,
      '',
      'File context (path => content excerpt):',
      JSON.stringify(context),
    ].join('\n');

    const schemaBody = {
      model: cfg.model,
      input: promptText,
      max_output_tokens: 2000,
      text: {
        format: {
          type: 'json_schema',
          name: 'task_plan',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              operations: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    relPath: { type: 'string' },
                    kind: { type: 'string', enum: ['write', 'delete'] },
                    goal: { type: 'string' },
                    newContent: { type: 'string' },
                  },
                  required: ['relPath', 'kind', 'goal', 'newContent'],
                },
              },
            },
            required: ['operations'],
          },
        },
      },
    };

    const schemaParsed = callResponsesApi(cfg.apiKey, schemaBody);
    const schemaText = schemaParsed ? extractResponseText(schemaParsed) : '';
    const schemaOps = schemaText ? parseOperationsFromText(schemaText) : null;
    if (schemaOps && schemaOps.length > 0) return schemaOps;

    const plainBody = {
      model: cfg.model,
      input: [
        'Return strictly JSON only with this schema:',
        '{"operations":[{"relPath":"string","kind":"write|delete","goal":"string","newContent":"string"}]}',
        '',
        promptText,
      ].join('\n'),
      max_output_tokens: 2000,
    };
    const plainParsed = callResponsesApi(cfg.apiKey, plainBody);
    const plainText = plainParsed ? extractResponseText(plainParsed) : '';
    const plainOps = plainText ? parseOperationsFromText(plainText) : null;
    if (!plainOps && !lastPlannerError) {
      lastPlannerError = 'Model returned no parseable JSON operations.';
    }
    return plainOps;
  };

  const first = requestPlan(contextFull);
  if (first && first.length > 0) return first;
  const retry = requestPlan(contextCompact);
  if (retry && retry.length > 0) return retry;
  return first ?? retry ?? null;
}

export function generateFileContentWithCodex(
  relPath: string,
  taskPrompt: string,
  currentContent?: string,
): string | null {
  const cfg = getOpenAiConfig();
  if (!cfg) return null;

  const input = [
    'Generate complete file content for a single file update in testbench/blog.',
    'Return only file content. No markdown fences. No explanation.',
    '',
    `Task prompt: ${taskPrompt}`,
    `Target file: ${relPath}`,
    currentContent ? 'Current content:' : 'This is a new file.',
    currentContent || '',
  ].join('\n');

  const parsed = callResponsesApi(cfg.apiKey, {
    model: cfg.model,
    input,
    max_output_tokens: 2200,
  });
  if (!parsed) return null;
  const text = extractResponseText(parsed);
  if (!text) return null;
  return text.replace(/^\s*```[a-zA-Z]*\s*/g, '').replace(/\s*```\s*$/g, '');
}
