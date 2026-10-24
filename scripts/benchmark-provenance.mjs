import { execFileSync } from 'node:child_process';

// Benchmarks identify a committed tree, never a stale hard-coded checkpoint or
// an index tree that omits working-tree edits. Keep generated results in .local.
export function benchmarkProvenance(cwd) {
  try {
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--'], { cwd, stdio: 'pipe' });
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd, encoding: 'utf8' }).trim();
    if (untracked) throw new Error(`Untracked inputs: ${untracked}`);
  } catch (error) {
    throw new Error('Commit the intended benchmark inputs first; dirty or untracked inputs cannot be attributed to a committed source tree.', { cause: error });
  }
  const read = ref => execFileSync('git', ['rev-parse', ref], { cwd, encoding: 'utf8' }).trim();
  return { sourceTree: read('HEAD^{tree}'), head: read('HEAD') };
}
