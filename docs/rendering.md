# Rendering Support In 0.1.0

The release matrix covers React 18.3.1 and 19.3.1 using ESM imports from the
packed archive. React and React DOM remain peer dependencies.

## Server Rendering And Hydration

Inkra keeps semantic text and controls in server-rendered markup; canvas and
Leaflet initialize in the browser. Its own layout work uses a server-safe hook.
The release pipeline hydrates a StrictMode fixture at desktop and mobile widths
with each React version. It checks state updates, input editing, number stepping,
Select, Tabs, dialog portals and focus return, lazy map initialization, simulated
canvas context restoration and readable fallback when canvas is unavailable.
This is automated Chromium coverage, not real-device or all-browser certification.

Use the same initial dates, locale, values, seed and theme on the server and
client. Supply deterministic calendar dates rather than computing different
values on opposite sides of a timezone or midnight boundary.

## Known Calendar Warning

react-day-picker 9 calls useLayoutEffect in its animation hook, including when
animation is disabled. React 18 development server rendering therefore emits a
layout-effect warning from DayPicker. The fixture reports this exact upstream
warning while failing other server warnings and all browser hydration errors.
Applications requiring warning-free React 18 SSR should render a stable
placeholder and mount Calendar after hydration. Inkra does not patch React,
silence console output in the product, or modify installed dependencies.

## Framework Boundaries

Next.js App Router and React Server Components are not validated integrations
for 0.1.0. Interactive Inkra components belong behind an application-owned
`'use client'` boundary, never directly inside a Server Component. No framework
compatibility or server-action support is claimed by the React peer range.

## Reproduce

After building and packing, install the test browser with
`npx playwright install chromium`, then run:

```sh
REACT_VERSION=18.3.1 node scripts/check-installed.mjs --browser
REACT_VERSION=19.3.1 node scripts/check-installed.mjs --browser
```

Each run installs the exact archive in an isolated consumer and checks its
integrity before testing. It never aliases to library source or reuses the docs
development server.
