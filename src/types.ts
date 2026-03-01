export interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  assessment?: any;
  resolved?: boolean;
}

export interface Commit {
  id: string;
  hash: string;
  author: string;
  date: string;
  message: string;
  diff: string;
  files: string[];
}

export interface GitState {
  current_branch: string;
  detached: boolean;
  head_hash: string;
  pending_changes: boolean;
}

export interface RuntimeStatus {
  mode: 'codex_mcp' | 'local_fallback';
  available: boolean;
  reason: string;
}
