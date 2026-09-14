/* Provider-neutral session parser for tools that expose JSON/JSONL transcripts. */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequest, createSession } from './parser-shared';
import type { Session, SessionRequest } from './types';

export type SupportedTool = 'antigravity' | 'claude' | 'codex' | 'cursor' | 'unknown';

const TOOL_ALIASES: Record<string, SupportedTool> = {
  antigravity: 'antigravity', 'google-antigravity': 'antigravity', gemini: 'antigravity',
  claude: 'claude', 'claude-code': 'claude',
  codex: 'codex', 'codex-cli': 'codex',
  cursor: 'cursor',
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join('\n');
  const item = record(value);
  if (typeof item.text === 'string') return item.text;
  if (typeof item.content === 'string' || Array.isArray(item.content)) return text(item.content);
  if (typeof item.message === 'string' || Array.isArray(item.message) || record(item.message).content) return text(item.message);
  return '';
}

function numberAt(value: unknown, keys: string[]): number | null {
  const item = record(value);
  for (const key of keys) {
    const n = item[key];
    if (typeof n === 'number' && Number.isFinite(n)) return n;
  }
  return null;
}

function timestamp(item: Record<string, unknown>): number | null {
  const value = item.timestamp ?? item.createdAt ?? item.created_at ?? item.time;
  if (typeof value === 'number') return value < 10_000_000_000 ? value * 1000 : value;
  if (typeof value === 'string') { const parsed = Date.parse(value); return Number.isNaN(parsed) ? null : parsed; }
  return null;
}

function role(item: Record<string, unknown>): 'user' | 'assistant' | null {
  const message = record(item.message);
  const value = item.role ?? message.role ?? item.author ?? item.type;
  if (typeof value !== 'string') return null;
  const lower = value.toLowerCase();
  if (lower.includes('user') || lower === 'human' || lower === 'prompt' || lower === 'input') return 'user';
  if (lower.includes('assistant') || lower === 'model' || lower === 'ai' || lower === 'response' || lower === 'completion') return 'assistant';
  return null;
}

function stringsMatching(value: unknown, keys: Set<string>, output: Set<string>): void {
  if (Array.isArray(value)) { value.forEach(v => stringsMatching(v, keys, output)); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (keys.has(key.toLowerCase()) && typeof child === 'string' && child.length < 1000) output.add(child);
    else if (typeof child === 'object') stringsMatching(child, keys, output);
  }
}

function makeRequest(userText: string, responseText: string, rows: Record<string, unknown>[]): SessionRequest {
  const tools = new Set<string>();
  const files = new Set<string>();
  let promptTokens = 0, completionTokens = 0;
  let hasPrompt = false, hasCompletion = false;
  for (const row of rows) {
    stringsMatching(row, new Set(['tool', 'toolname', 'name', 'function']), tools);
    stringsMatching(row, new Set(['path', 'filepath', 'file_path', 'file']), files);
    const usage = row.usage ?? row.tokens ?? row.tokenUsage;
    const input = numberAt(usage, ['promptTokens', 'inputTokens', 'input']);
    const output = numberAt(usage, ['completionTokens', 'outputTokens', 'output']);
    if (input != null) { promptTokens += input; hasPrompt = true; }
    if (output != null) { completionTokens += output; hasCompletion = true; }
  }
  return createRequest({
    messageText: userText,
    responseText,
    timestamp: rows.map(timestamp).find((v): v is number => v != null) ?? null,
    toolsUsed: [...tools].filter(v => !v.includes('function')),
    editedFiles: [...files].filter(v => /\.(ts|tsx|js|jsx|py|go|rs|java|rb|php|swift|kt|css|html|md|json|yaml|yml)$/i.test(v)),
    promptTokens: hasPrompt ? promptTokens : null,
    completionTokens: hasCompletion ? completionTokens : null,
    modelId: rows.map(r => String(r.model ?? record(r.message).model ?? '')).find(Boolean) ?? '',
  });
}

export function normalizeTool(value?: string): SupportedTool {
  return TOOL_ALIASES[(value ?? '').toLowerCase()] ?? 'unknown';
}

export function parseUniversalSession(content: string, source = 'session.jsonl', tool?: string): Session | null {
  const rows = content.split(/\r?\n/).map(line => { try { return record(JSON.parse(line)); } catch { return null; } }).filter(r => Object.keys(r).length > 0);
  if (!rows.length) {
    try { const parsed = JSON.parse(content); rows.push(record(parsed)); } catch { return null; }
  }
  const requests: SessionRequest[] = [];
  let userText = '', assistantText = '', turnRows: Record<string, unknown>[] = [];
  for (const row of rows) {
    const kind = role(row);
    const value = text(row);
    if (kind === 'user') {
      if (userText || assistantText) requests.push(makeRequest(userText, assistantText, turnRows));
      userText = value; assistantText = ''; turnRows = [row];
    } else if (kind === 'assistant') {
      assistantText += (assistantText ? '\n' : '') + value; turnRows.push(row);
    } else if (userText || assistantText) turnRows.push(row);
  }
  if (userText || assistantText) requests.push(makeRequest(userText, assistantText, turnRows));
  if (!requests.length) return null;
  const normalized = normalizeTool(tool);
  const harness = normalized === 'unknown' ? 'Other' : normalized[0].toUpperCase() + normalized.slice(1);
  const id = path.basename(source).replace(/\.(jsonl?|ndjson)$/i, '') || crypto.randomUUID();
  return createSession({ sessionId: id, workspaceId: `${harness.toLowerCase()}-${id}`, workspaceName: path.basename(path.dirname(source)) || 'workspace', harness, location: source, requests });
}

export function parseUniversalFile(filePath: string, tool?: string): Session | null {
  return parseUniversalSession(fs.readFileSync(filePath, 'utf8'), filePath, tool);
}
