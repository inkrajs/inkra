import test from 'node:test';
import assert from 'node:assert/strict';
import { JourneyPlaceMotion, interpolateJourneyPosition } from '../dist/journey-map/motion.js';
const position = longitude => ({ latitude: 0, longitude });
function harness() {
 let time = 0, serial = 0; const jobs = new Map(), positions = new Map();
 const runtime = { now: () => time, request: callback => { jobs.set(++serial, callback); return serial; }, cancel: id => jobs.delete(id) };
 const motion = new JourneyPlaceMotion((id, value) => positions.set(id, value), runtime);
 return { motion, positions, jobs, advance(ms) { time += ms; const pending = [...jobs.values()]; jobs.clear(); pending.forEach(callback => callback(time)); } };
}
test('positions follow the shortest longitude path, with exact endpoints and configurable easing', () => {
 assert.equal(interpolateJourneyPosition(position(179), position(-179), .5).longitude, 180);
 assert.equal(interpolateJourneyPosition(position(0), position(10), .25).longitude, 2.5);
 assert.equal(interpolateJourneyPosition(position(0), position(10), .25, 'ease-in-out').longitude, 1.5625);
 assert.deepEqual(interpolateJourneyPosition(position(1), position(2), -1), position(1));
});
test('one shared frame loop moves multiple markers; retargeting starts at the displayed position', () => {
 const h = harness();
 h.motion.move('horse', position(0), position(10), { duration: 1000 });
 h.motion.move('person', position(0), position(20), { duration: 2000 });
 assert.equal(h.jobs.size, 1);
 h.advance(250); assert.equal(h.positions.get('horse').longitude, 2.5);
 h.motion.move('horse', h.positions.get('horse'), position(20), { duration: 1000 });
 h.advance(500); assert.equal(h.positions.get('horse').longitude, 11.25);
 assert.equal(h.positions.get('person').longitude, 7.5);
 h.motion.clear(); assert.equal(h.jobs.size, 0);
});
test('pause cancels idle frames, freezes position and resumes the remaining time', () => {
 const h = harness(); h.motion.move('a', position(0), position(10), { duration: 1000 });
 h.advance(300); const frozen = h.positions.get('a');
 h.motion.move('a', frozen, position(10), { duration: 1000, paused: true });
 assert.equal(h.jobs.size, 0); h.advance(5000); assert.deepEqual(h.positions.get('a'), frozen);
 h.motion.move('a', frozen, position(10), { duration: 1000 });
 h.advance(350); assert.equal(h.positions.get('a').longitude, 6.5);
 h.advance(350); assert.equal(h.positions.get('a').longitude, 10); assert.equal(h.jobs.size, 0);
});
test('repeated identical targets do not restart motion; removal and reduced motion cancel work', () => {
 const h = harness(); h.motion.move('a', position(0), position(10), { duration: 1000 });
 h.advance(250); h.motion.move('a', h.positions.get('a'), position(10), { duration: 1000 });
 h.advance(750); assert.equal(h.positions.get('a').longitude, 10); assert.equal(h.jobs.size, 0);
 h.motion.move('a', position(10), position(20), true); h.motion.remove('a'); assert.equal(h.jobs.size, 0);
 h.motion.move('a', position(10), position(30), { duration: 1000 }, true);
 assert.equal(h.positions.get('a').longitude, 30); assert.equal(h.jobs.size, 0);
 h.motion.move('a', position(30), position(40), false);
 assert.equal(h.positions.get('a').longitude, 40); assert.equal(h.jobs.size, 0);
});
