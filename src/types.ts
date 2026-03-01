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
