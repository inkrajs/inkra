import { useEffect, useLayoutEffect } from 'react';

// Layout and canvas work only runs after the server markup reaches a browser.
export const useBrowserLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;
