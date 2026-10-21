<p align="center"><img src="assets/inkra.png" alt="Inkra pencil mark" width="80"></p>

# Inkra

[中文](README.zh-CN.md) · [Package API](packages/inkra/README.md) · [Contributing](CONTRIBUTING.md)

A pencil-styled React component library with semantic controls, deterministic
hand-drawn materials, and an interactive documentation playground.

**Release status:** [`@inkra/react@0.1.0`](https://www.npmjs.com/package/@inkra/react)
is published. The release pipeline verified the public archive and clean
React 18/19 installations before creating the
[GitHub Release](https://github.com/inkrajs/inkra/releases/tag/react-v0.1.0).
Website publication is owned by
[inkrajs.github.io](https://github.com/inkrajs/inkrajs.github.io), separately from npm releases.

The npm package is **`@inkra/react`**. The earlier unscoped name `inkra` was
rejected by npm's name-similarity policy. Releases use `react-vX.Y.Z` Git tags;
the unsuccessful `v0.1.0` tag is retained as history, not a published release.

## Components

| Area | Components |
| --- | --- |
| Actions and overlays | Button, ButtonLink, ButtonGroup, Popover, Overlay, Tooltip, DropdownMenu |
| Forms | Field, Input, InputNumber, Textarea, Checkbox, RadioGroup, Switch, Select, Slider |
| Structure and feedback | Tabs, Breadcrumb, Accordion, Badge, Separator, Skeleton, Progress, Alert, Avatar, Card, Table |
| Travel and schedules | Calendar, DayAgenda, JourneyMap |
| Drawing | PencilIcon, PencilText, PencilSurface, PencilLine, shared tokens |

Select includes single/multiple selection and a separate searchable combobox.
PencilIcon renders supplied paths; the searchable Lucide catalog in the docs is
an example application, not another exported icon package.

Real DOM elements own form values, selectable text and keyboard interaction.
Canvas supplies pressure, grain and paper texture. Themes, RTL, reduced motion
and forced-color fallbacks are design requirements, not an accessibility certification.

## Try Locally

Use Node.js 22.12+ and npm. No private registry credentials are required.

```sh
npm ci
npm run build
npm run check:package
```

The playground belongs to [inkrajs/docs](https://github.com/inkrajs/docs).
In that checkout, run `npm run prepare:library -- /absolute/path/to/inkra`, then
`npm run dev -- --port 4180`. Open `http://127.0.0.1:4180` for live properties,
generated example code, API tables and accessibility notes. Rebuild, repack and
prepare again after library changes. `INKRA_DOCS_DIR=/path/to/docs npm run dev`
is an optional launcher from this checkout; it does not refresh the candidate.

## Installation

```sh
npm install @inkra/react
```

For unpublished local changes, build and run `npm run check:package`, then
install the archive named in `.release/manifest.json` in a separate React project.

Import styles once at the application entry point:

```tsx
import '@inkra/react/styles.css';
import { Button, Field, Input } from '@inkra/react';

export function NoteForm() {
  return (
    <form>
      <Field label="Note title"><Input name="title" clearable /></Field>
      <Button type="submit">Save</Button>
    </form>
  );
}
```

The package is ESM with TypeScript declarations and React/React DOM peers.
React 18/19 form the tested release matrix. The release pipeline checks browser hydration
from server markup, controls, portals, canvas recovery and the lazy-loaded map
using the installed archive. See [rendering support and limits](docs/rendering.md)
for the known React 18 Calendar warning and the unverified Next.js/RSC boundary.

## Repository

Source and maintenance: [inkrajs/inkra](https://github.com/inkrajs/inkra).

See the [organization structure](docs/organization-structure.md) for the six
approved repository boundaries. Source, remote CI, website deployment and npm
publication have separate verification gates.

| Path | Purpose |
| --- | --- |
| `packages/inkra` | Publishable library, CSS, font and notices |
| `assets` | Repository branding assets |
| `docs/design-standard.md` | Visual and interaction rules |
| `scripts` | Repository and installed-package checks |
| `.github/workflows` | PR checks, candidate preparation and approval-gated npm releases |

Run `npm run check` for portability checks, package tests, tarball
contents and SSR/types/assets after installing that exact tarball in a temporary
project. The independent docs repository owns its build and browser checks.
The existing local `apps/docs` path is an ignored independent Git checkout, not
a library workspace. There is no automatic npm publication or deployment.
The manual `Release npm package` workflow defaults to validation only. Its
OIDC, first-package bootstrap and registry verification modes are documented
in [the release guide](docs/releasing.md).

## Contribute and Report

Read [CONTRIBUTING.md](CONTRIBUTING.md), use the non-sensitive issue templates,
and follow [SECURITY.md](SECURITY.md) for security concerns. Release changes
belong in [CHANGELOG.md](CHANGELOG.md).

## License

Inkra code uses [MIT](LICENSE). The handwriting font uses SIL OFL 1.1 and Leaflet
assets retain their own license; see [third-party notices](packages/inkra/THIRD_PARTY_NOTICES.md).
