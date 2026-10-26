import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatPlanSummary, planComponentTests } from './component-test-plan.mjs';

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const root = resolve(option('--root') ?? fileURLToPath(new URL('../', import.meta.url)));
const base = option('--base');
const testedRevision = option('--tested-revision') ?? 'HEAD';
const requestedHead = option('--requested-head');
const output = resolve(root, option('--output') ?? '.release/component-test-plan.json');
if (!base) throw new Error('Usage: node scripts/plan-component-tests.mjs --base <commit> [--tested-revision <commit>] [--requested-head <commit>] [--output <path>]');

const plan = planComponentTests({ root, base, requestedHead, testedRevision });
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(plan, null, 2) + '\n');
console.log(formatPlanSummary(plan));
console.log(`Plan JSON: ${output}`);
