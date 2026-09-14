import { describe, expect, it } from 'vitest';
import { parseUniversalSession } from './parser-universal';

describe('provider-neutral session parser', () => {
  it.each(['cursor', 'antigravity', 'claude', 'codex'])('normalizes %s sessions', (tool) => {
    const session = parseUniversalSession([
      JSON.stringify({ role: 'user', timestamp: '2026-09-14T00:00:00Z', content: 'Fix the parser' }),
      JSON.stringify({ role: 'assistant', model: 'test-model', content: [{ type: 'text', text: 'Done' }], tool: 'Edit', file_path: 'src/parser.ts', usage: { inputTokens: 12, outputTokens: 8 } }),
    ].join('\n'), `${tool}-session.jsonl`, tool);
    expect(session?.harness).toBe(tool[0].toUpperCase() + tool.slice(1));
    expect(session?.requests[0].messageText).toBe('Fix the parser');
    expect(session?.requests[0].editedFiles).toContain('src/parser.ts');
    expect(session?.requests[0].promptTokens).toBe(12);
  });
});
