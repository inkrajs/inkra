import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatPlanSummary, validatePlan } from './component-test-plan.mjs';
import { selectLocallyValidatedTests } from './component-local-validation.mjs';

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const root = resolve(option('--root') ?? fileURLToPath(new URL('../', import.meta.url)));
const planPath = resolve(root, option('--plan') ?? '.release/component-test-plan.json');
const plan = JSON.parse(await readFile(planPath, 'utf8'));
const { selected: planned } = validatePlan(plan, root);
const { selected } = await selectLocallyValidatedTests(root, planned, process.env.LOCAL_VALIDATION_REPORT);
console.log(formatPlanSummary(plan));

if (selected.length === 0) {
  console.log('No component tests were selected. Full type, build and package contract checks still run in CI.');
  process.exit(0);
}

const result = spawnSync(process.execPath, ['--test', ...selected], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
