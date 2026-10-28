import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function componentLocalValidation(tests, receipt, { targetRevision, targetTree, environment }) {
  const waived = [];
  if (!receipt?.accepted) return { selected: [...tests], waived };
  assert.equal(receipt.repository, 'inkrajs/inkra', 'Wrong local-validation repository');
  assert.equal(receipt.targetRevision, targetRevision, 'Local validation belongs to another execution commit');
  assert.equal(receipt.targetTree, targetTree, 'Local validation belongs to another execution tree');
  assert.equal(receipt.headTree, targetTree, 'Merge contains changes outside the locally tested tree');
  assert(Array.isArray(receipt.declarations), 'Missing local test declarations');
  assert(receipt.componentGroups && typeof receipt.componentGroups === 'object' && !Array.isArray(receipt.componentGroups),
    'Missing trusted component test group mapping');
  for (const path of tests) {
    const declaration = receipt.declarations.find(entry => {
      if (!/^component:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.group) || !entry.environments.includes(environment)) return false;
      const group = receipt.componentGroups[entry.group];
      assert(Array.isArray(group) && group.every(file => /^packages\/inkra\/test\/[a-z0-9-]+\.test\.mjs$/.test(file)),
        'Invalid trusted component test group mapping');
      return group.includes(path);
    });
    if (declaration) waived.push({ path, ...declaration, actor: receipt.actor, prUrl: receipt.prUrl });
  }
  return { selected: tests.filter(path => !waived.some(entry => entry.path === path)), waived };
}

export async function selectLocallyValidatedTests(root, tests, receiptPath) {
  if (!receiptPath) return { selected: [...tests], waived: [] };
  const receipt = JSON.parse(await readFile(resolve(root, receiptPath), 'utf8'));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const environment = 'node' + process.versions.node.split('.')[0] + '-react' + (process.env.REACT_VERSION || '19.3.1');
  const result = componentLocalValidation(tests, receipt, {
    targetRevision: git(['rev-parse', 'HEAD']), targetTree: git(['rev-parse', 'HEAD^{tree}']), environment,
  });
  const report = { environment, targetRevision: git(['rev-parse', 'HEAD']), executed: result.selected, locallyConfirmed: result.waived };
  await mkdir(resolve(root, '.release'), { recursive: true });
  await writeFile(resolve(root, '.release/component-local-validation-' + environment + '.json'), JSON.stringify(report, null, 2) + '\n');
  const markdown = '### Component local validation (' + environment + ')\n\n'
    + result.selected.length + ' test files to execute online; ' + result.waived.length + ' locally confirmed / CI waived.\n\n'
    + result.waived.map(entry => '- ' + entry.path + ' — ' + entry.group + ' — ' + JSON.stringify(entry.actor?.login) + ' — ' + JSON.stringify(entry.evidence) + '\n').join('');
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
  return result;
}

async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const tests = (await readdir(resolve(root, 'packages/inkra/test'))).filter(file => file.endsWith('.test.mjs'))
    .sort().map(file => 'packages/inkra/test/' + file);
  const { selected } = await selectLocallyValidatedTests(root, tests, process.env.LOCAL_VALIDATION_REPORT);
  if (!selected.length) return;
  const result = spawnSync(process.execPath, ['--test', ...selected], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
