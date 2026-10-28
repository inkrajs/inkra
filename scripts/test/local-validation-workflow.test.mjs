import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../../.github/workflows/check.yml', import.meta.url), 'utf8');
test('local test decisions run trusted base code and read GitHub editor identity without executing PR text', () => {
  const resolver = workflow.split('  local-validation:')[1].split('  package:')[0];
  assert.match(resolver, /ref: \$\{\{ github.event.pull_request.base.sha \|\| github.sha \}\}/);
  assert.match(resolver, /node \.trusted-ci\/scripts\/resolve-pr-local-validation.mjs/);
  assert.match(resolver, /HEAD_SHA: \$\{\{ github.event.pull_request.head.sha \}\}/);
  assert.match(resolver, /BASE_SHA: \$\{\{ github.event.pull_request.base.sha \}\}/);
  assert.match(resolver, /TARGET_SHA: \$\{\{ github.sha \}\}/);
  assert.doesNotMatch(resolver, /npm (?:ci|install)|pull_request.body|continue-on-error/);
  assert.match(resolver, /policy-bootstrap/);
  assert.match(workflow, /types: \[opened, synchronize, reopened, edited, ready_for_review\]/);
});
test('local confirmations retain mandatory contracts and report exact waived groups independently of test planning', () => {
  assert.match(workflow, /needs: local-validation/);
  assert.match(workflow, /name: local-validation[\s\S]*path: \.release/);
  assert.match(workflow, /LOCAL_VALIDATION_REPORT: \.release\/local-validation.json/);
  assert.match(workflow, /if: github.event_name == 'pull_request' \|\| needs.local-validation.outputs.accepted == 'true'\n\s+run: npm run check:contracts/);
  assert.match(workflow, /if: github.event_name != 'pull_request' && needs.local-validation.outputs.accepted == 'true'\n\s+run: node scripts\/component-local-validation.mjs/);
});
