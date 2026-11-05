import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

for (const phrase of ['Real music data', 'Pattern source', 'Load Groove Dataset', 'Real bar', 'All recorded genres']) {
  assert.ok(!html.includes(phrase), `Removed interface text must not appear: ${phrase}`);
}
for (const id of ['load-dataset', 'file-input', 'real-pattern', 'learned-pattern', 'variation', 'bar-count']) {
  assert.ok(!html.includes(`id="${id}"`), `Obsolete control is removed: ${id}`);
}
for (const id of ['mode-genre', 'mode-recipe', 'generate-genre', 'generate-recipe', 'fetch-livepilot', 'grid', 'export-midi']) {
  assert.ok(html.includes(`id="${id}"`), `Core functionality is retained: ${id}`);
}

const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
const startup = app.slice(app.indexOf("  $('#bpm').addEventListener"));
const listeners = [...startup.matchAll(/\$\('#([^']+)'\)\.addEventListener/g)].map(match => match[1]);
for (const selector of listeners) assert.ok(ids.has(selector), `Active startup listener requires #${selector}`);
assert.ok(!/recorded performances|human-played bars/i.test(html), 'No stale recorded-data promotion');

console.log('Interface cleanup passed: obsolete panels removed; genre, recipe and editing controls intact.');
