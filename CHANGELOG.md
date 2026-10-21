# Changelog

## 0.1.0 - 2026-10-22

Published as `@inkra/react@0.1.0` with the `latest` npm dist-tag and
the `react-v0.1.0` GitHub Release. The public archive matches the approved
Actions candidate; clean registry installations passed with React 18 and 19.

- The approved npm package name is `@inkra/react`; npm rejected the earlier
  unscoped `inkra` name as too similar to existing packages. Public imports,
  installed-package checks and the documentation consumer use the scoped name.
- Release tags now use `react-vX.Y.Z`, preserving the unsuccessful `v0.1.0` tag.

### Components

- Pencil drawing primitives, semantic action/form controls, overlays,
  navigation, content and feedback components.
- Single/multiple Select, a separate searchable Select, decorative trigger
  slots, hidden value/indicator options and icon-only triggers.
- Calendar, DayAgenda and JourneyMap using caller-provided data.
- Localized documentation with grouped interactive property controls.

### Release Preparation

- Bilingual introduction, maintenance templates and root MIT license.
- Public-registry lockfile and portable browser-test imports.
- Repository and tarball checks, candidate digest, installed-package SSR/types/
  assets, read-only CI and manual candidate artifacts.
- A manually triggered, approval-gated npm pipeline: candidate validation,
  OIDC publishing, first-package staging and registry installation verification.

### Rendering And Compatibility

- Server-safe layout effects for Inkra drawing and input components, and
  React 18-compatible ref forwarding through portal theme containers.
- Installed-package StrictMode hydration checks for React 18/19, including
  controls, portals, lazy maps, canvas recovery and unavailable-canvas fallback.

### Known Limits

- Calendar's upstream DayPicker animation hook emits a React 18 development
  SSR layout-effect warning. Browser hydration is tested separately.
- Next.js/RSC integration is not certified; components require a client boundary.
