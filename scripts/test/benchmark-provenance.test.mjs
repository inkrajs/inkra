import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { benchmarkProvenance } from '../benchmark-provenance.mjs';

test('benchmark provenance identifies committed inputs and rejects hidden source drift', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'inkra-provenance-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  try {
    git('init');
    writeFileSync(join(cwd, 'input.txt'), 'original\n');
    git('add', 'input.txt');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture');
    assert.deepEqual(benchmarkProvenance(cwd), { sourceTree: git('rev-parse', 'HEAD^{tree}'), head: git('rev-parse', 'HEAD') });
    writeFileSync(join(cwd, 'input.txt'), 'modified\n');
    assert.throws(() => benchmarkProvenance(cwd), /Commit the intended benchmark inputs/);
    git('add', 'input.txt');
    assert.throws(() => benchmarkProvenance(cwd), /Commit the intended benchmark inputs/);
    git('reset', '--hard', 'HEAD');
    writeFileSync(join(cwd, 'new-input.txt'), 'untracked\n');
    assert.throws(() => benchmarkProvenance(cwd), /Commit the intended benchmark inputs/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
