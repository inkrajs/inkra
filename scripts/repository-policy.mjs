import assert from 'node:assert/strict';

export function checkComponentTestPortability(path, source) {
  if (!path.startsWith('packages/inkra/test/')) return;
  assert(!/apps[\\/]docs/.test(source), `Library tests must not depend on the separate docs checkout: ${path}`);
  assert(!/(?:^|[\\/"'`\s])\.(?:release|local)[\\/]/m.test(source),
    `Component tests must not read ignored local handoffs or artifacts: ${path}`);
}
