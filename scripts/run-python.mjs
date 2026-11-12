// Runs a Python script with whichever Python command this computer has.
// Windows' standard installer provides the 'py' launcher; Linux and macOS use
// 'python3'. (On Windows, 'python' and 'python3' may instead be Microsoft Store
// shortcuts that only print an install message.)
//
// Usage: node scripts/run-python.mjs <script.py> [args...]
import { spawnSync } from 'node:child_process';

const candidates = process.platform === 'win32'
  ? [['py', ['-3']], ['python3', []], ['python', []]]
  : [['python3', []], ['python', []]];

for (const [cmd, prefix] of candidates) {
  const result = spawnSync(cmd, [...prefix, ...process.argv.slice(2)], { stdio: 'inherit' });
  if (result.error?.code === 'ENOENT') continue; // not installed under this name; try the next
  process.exit(result.status ?? 1);
}
console.error('Python 3 was not found. Install it from python.org; the installer includes the "py" launcher.');
process.exit(1);
