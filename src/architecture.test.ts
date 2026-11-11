// Design rule checks for the code itself (D-13). Like a DRC on a PCB layout:
// rather than trusting everyone to remember the layering rules, a test scans
// the source and fails if a rule is broken.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('.', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.ts$/.test(e.name) && e.name !== 'test-helpers.ts' ? [p] : [];
  });
}

/** Source text with comments removed, so explanations that mention a rule don't trip it. */
const code = (file: string) =>
  readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function offenders(dir: string, pattern: RegExp): string[] {
  return sourceFiles(join(SRC, dir)).filter((f) => pattern.test(code(f))).map((f) => relative(SRC, f));
}

const CLOCK = /\bDate\.now\b|\bnew Date\b/;
// 'window' alone is also our word for a task's months, so only window./document. count.
const BROWSER = /\b(localStorage|sessionStorage|indexedDB|navigator)\b|\b(window|document)\./;

test('D-13: the core never reads the clock — "today" is always passed in', () => {
  assert.deepEqual(offenders('core', CLOCK), []);
});

test('D-13: the core never touches the browser (no DOM, no storage)', () => {
  assert.deepEqual(offenders('core', BROWSER), []);
});

test('D-09: the storage module does not reach for localStorage itself — it is handed a store', () => {
  assert.deepEqual(offenders('storage', BROWSER), []);
  assert.deepEqual(offenders('storage', CLOCK), []);
});

test('D-13: the core does not depend on the storage module or the screens', () => {
  assert.deepEqual(offenders('core', /from '\.\.\/(storage|ui)\//), []);
});
