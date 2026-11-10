// Check data/plants.json and print any problems.   npm run validate-data
import { readFileSync } from 'node:fs';
import { validateLibrary } from '../src/core/library.ts';

const path = new URL('../data/plants.json', import.meta.url);
const data: unknown = JSON.parse(readFileSync(path, 'utf8'));
const errors = validateLibrary(data);

if (errors.length) {
  console.error(`plants.json has ${errors.length} problem(s):\n  ` + errors.join('\n  '));
  process.exit(1);
}
const lib = data as { plants: { tasks: unknown[] }[] };
const tasks = lib.plants.reduce((n, p) => n + p.tasks.length, 0);
console.log(`plants.json is valid: ${lib.plants.length} plants, ${tasks} tasks`);
