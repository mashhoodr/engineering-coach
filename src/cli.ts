#!/usr/bin/env node
import * as fs from 'node:fs';
import { parseUniversalFile, normalizeTool } from './core/parser-universal';

const args = process.argv.slice(2);
const toolIndex = args.indexOf('--tool');
const tool = toolIndex >= 0 ? args[toolIndex + 1] : undefined;
const files = args.filter((arg, index) => arg !== '--tool' && index !== toolIndex + 1 && !arg.startsWith('-'));
if (!files.length) {
  console.error('Usage: npm run analyze -- [--tool cursor|antigravity|claude|codex] <session.jsonl> [more files]');
  process.exit(1);
}
const sessions = files.map(file => {
  if (!fs.statSync(file).isFile()) throw new Error(`Not a file: ${file}`);
  return parseUniversalFile(file, tool);
}).filter(Boolean);
const summary = sessions.reduce((result, session) => {
  result.sessions++;
  result.requests += session!.requests.length;
  result.tools.push(...session!.requests.flatMap(request => request.toolsUsed));
  return result;
}, { tool: normalizeTool(tool), sessions: 0, requests: 0, tools: [] as string[] });
console.log(JSON.stringify({ ...summary, tools: [...new Set(summary.tools)] }, null, 2));
