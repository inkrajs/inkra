import { PencilIcon } from '../PencilIcon.js';
// Lucide ISC geometry rendered through the same pencil renderer as the trip tools.
const paths = {
  plus: [{ d: 'M5 12h14' }, { d: 'M12 5v14' }],
  minus: [{ d: 'M5 12h14' }],
  reset: [{ d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }, { d: 'M3 3v5h5' }],
  previous: [{ d: 'm12 19-7-7 7-7' }, { d: 'M19 12H5' }],
  next: [{ d: 'M5 12h14' }, { d: 'm12 5 7 7-7 7' }],
  info: [{ d: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0' }, { d: 'M12 16v-4' }, { d: 'M12 8h.01' }],
};
export function TravelIcon({ name }: { name: keyof typeof paths }) {
  return <PencilIcon paths={paths[name]} sourceSize={24} size={30} />;
}
