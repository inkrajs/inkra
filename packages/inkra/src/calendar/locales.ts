import { enUS, zhCN, ja, ko, fr } from 'react-day-picker/locale';
import type { InkraLocale } from '../i18n/index.js';

export const calendarLocales = { en: enUS, 'zh-CN': zhCN, ja, ko, fr } satisfies Record<InkraLocale, typeof enUS>;
