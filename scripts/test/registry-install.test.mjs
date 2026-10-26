import assert from 'node:assert/strict';
import test from 'node:test';
import { installRegistryVersion } from '../registry-install.mjs';

const name = '@inkra/react';
const version = '0.9.0';
const pending = Object.assign(new Error('npm index pending'), {
  status: 1, stderr: 'npm error code ETARGET\nnpm error notarget No matching version found for @inkra/react@0.9.0.\n',
});
function timing() {
  let time = 0;
  const delays = [];
  return { name, version, delays, now: () => time,
    advance: ms => { time += ms; }, sleep: async ms => { delays.push(ms); time += ms; } };
}

test('available npm installation completes once without waiting', async () => {
  const clock = timing();
  assert.equal(await installRegistryVersion(async () => 'installed', clock), 'installed');
  assert.deepEqual(clock.delays, []);
});

test('only propagation of this exact version is retried with bounded backoff', async () => {
  const clock = timing();
  let calls = 0;
  await installRegistryVersion(async () => { if (++calls < 6) throw pending; }, clock);
  assert.equal(calls, 6);
  assert.deepEqual(clock.delays, [5000, 10000, 20000, 30000, 30000]);
});

test('installation deadline includes request time and retains the last error', async () => {
  const clock = timing();
  let calls = 0;
  await assert.rejects(installRegistryVersion(async remaining => {
    assert(remaining <= 12000);
    calls++; clock.advance(1000); throw pending;
  }, { ...clock, timeoutMs: 12000 }), error => error === pending);
  assert.equal(calls, 2);
  assert.equal(clock.now(), 12000);
  assert.deepEqual(clock.delays, [5000, 5000]);
});

test('transitive package, auth, integrity, network and killed processes fail immediately', async () => {
  for (const error of [
    new Error('offline'),
    { ...pending, status: null, signal: 'SIGTERM' },
    { ...pending, stderr: pending.stderr.replace(version, '0.8.0') },
    { ...pending, stderr: pending.stderr.replace(name, 'react') },
    ...['E401', 'E403', 'E429', 'E500', 'EINTEGRITY', 'ECONNRESET', 'ERESOLVE'].map(code => ({ ...pending, stderr: pending.stderr.replace('ETARGET', code) })),
  ]) {
    const clock = timing();
    let calls = 0;
    await assert.rejects(installRegistryVersion(async () => { calls++; throw error; }, clock), caught => caught === error);
    assert.equal(calls, 1);
    assert.deepEqual(clock.delays, []);
  }
  await assert.rejects(installRegistryVersion(() => {}, { timeoutMs: 0 }), /positive timeout/);
});
