import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('Carousel controlled selection retains the Embla engine and real option changes invalidate it', () => {
  execFileSync(process.execPath, ['--experimental-test-module-mocks', fileURLToPath(new URL('./fixtures/carousel-performance.mjs', import.meta.url))], { encoding: 'utf8' });
});
