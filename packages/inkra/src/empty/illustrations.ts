import type { PencilIconPath } from '../PencilIcon.js';

export type EmptyIllustration = 'inbox' | 'search' | 'folder' | 'documents' | 'messages' | 'image' | 'offline' | 'favorites';

type Illustration = { ink: readonly PencilIconPath[]; accent: readonly PencilIconPath[] };
const line = (d: string): PencilIconPath => ({ d, mode: 'scuff' });
const wash = (d: string): PencilIconPath => ({ d, mode: 'wash' });

// Geometry lives in a 40-unit square. Fine strokes keep large illustrations airy.
export const emptyIllustrations: Record<EmptyIllustration, Illustration> = {
  inbox: {
    ink: [
      line('M7 21 12 15H28L33 21V31H7Z'),
      line('M7 21H15L17 25H23L25 21H33'),
      line('M14 19V9H24L28 13V19'),
      line('M24 9V13H28'), line('M17 13H21 M17 16H24'),
      line('M10 28H14 M26 28H30'), line('M5 34Q19 35 35 33'),
      line('M8 12 6 10 M32 14 35 12 M19 5V3'),
    ],
    accent: [wash('M8 23H14L17 27H23L26 23H32V30H8Z'), line('M17 19H24'), line('M30 7H34 M32 5V9')],
  },
  search: {
    ink: [
      line('M23 29H8V8H24L28 12V17'), line('M24 8V12H28'),
      line('M12 13H20 M12 17H17 M12 21H15 M12 25H18'),
      line('M31 23A7 7 0 1 1 17 23A7 7 0 1 1 31 23'),
      line('M29 28 35 34 33 36 27 30'), line('M20 23Q20 20 23 19'),
      line('M5 33H20 M4 17V20'),
    ],
    accent: [wash('M11 9H22V16H11Z'), line('M22 24H26'), line('M32 10H36 M34 8V12')],
  },
  folder: {
    ink: [
      line('M6 29V12H16L19 15H31V19'),
      line('M7 31 11 20H35L30 31Z'), line('M14 18V9L26 7 28 17'),
      line('M17 12 23 11 M17 15 24 14'), line('M14 24H22'),
      line('M5 34Q20 35 34 33'), line('M4 20 2 19 M32 10 34 8'),
    ],
    accent: [wash('M12 22H33L29 30H9Z'), line('M7 12H15'), line('M8 5V8 M6.5 6.5H9.5')],
  },
  documents: {
    ink: [
      line('M10 28 7 10 21 7'), line('M13 31 11 8 28 6 29 12'),
      line('M16 12H27L33 18V33H16Z'), line('M27 12V18H33'),
      line('M20 21H28 M20 25H28 M20 29H25'),
      line('M7 35H30 M5 25V28'),
    ],
    accent: [wash('M12 9 25 7 26 10 14 10 14 29 13 29Z'), line('M20 17H23'), line('M33 6V10 M31 8H35')],
  },
  messages: {
    ink: [
      line('M7 9H27Q29 9 29 11V22Q29 24 27 24H16L10 29V24H7Q5 24 5 22V11Q5 9 7 9Z'),
      line('M32 16H33Q35 16 35 18V29Q35 31 33 31H30V35L25 31H19Q17 31 17 29V27'),
      line('M10 14H23 M10 18H19'), line('M5 33H10'),
    ],
    accent: [wash('M20 26H27Q31 26 31 22V18H33V29H29V31L26 29H20Z'), line('M22 19H24'), line('M31 4V8 M29 6H33')],
  },
  image: {
    ink: [
      line('M7 27 5 10 29 7 30 11'), line('M10 13H34V31H10Z'),
      line('M11 27 18 20 24 26 28 22 33 27'),
      line('M29 18A2 2 0 1 1 25 18A2 2 0 1 1 29 18'),
      line('M7 35Q21 36 34 34'), line('M4 23V26'),
    ],
    accent: [wash('M12 28 18 22 24 28 28 24 33 29H12Z'), line('M10 8 23 6'), line('M34 5V9 M32 7H36')],
  },
  offline: {
    ink: [
      line('M14 24H10A5 5 0 0 1 9 14A8 8 0 0 1 24 12A6 6 0 0 1 32 24H26'),
      line('M18 21 15 25H20L17 30 M23 22 20 27H25L22 32'),
      line('M7 32H12 M28 31H33'), line('M13 12Q15 9 18 10'),
      line('M3 10 5 11 M30 7 32 5'),
    ],
    accent: [wash('M8 19Q16 22 32 19V23H25L23 20H17L15 23H10Q7 23 8 19Z'), line('M16 35H22'), line('M24 5V3')],
  },
  favorites: {
    ink: [
      line('M11 8H28V33L20 28 11 33Z'), line('M8 26V5H25'),
      line('M20 12 22 16 27 17 23.5 20.5 24.5 25 20 22.5 15.5 25 16.5 20.5 13 17 18 16Z'),
      line('M7 36H31 M32 26V29'),
    ],
    accent: [wash('M20 14 21.5 17.5 25 18 22 20 23 23 20 21 17 23 18 20 15 18 18.5 17.5Z'), line('M32 10V14 M30 12H34')],
  },
};
