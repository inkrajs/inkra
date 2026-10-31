<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/inkra-dark.png">
    <img src="./assets/inkra.png" alt="Inkra pencil mark" width="96" height="96">
  </picture>
</p>

<p align="center">English | <a href="./README.zh-CN.md">简体中文</a> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a> | <a href="./README.fr.md">Français</a></p>

<h1 align="center">Inkra</h1>

<p align="center">Build your interface like you draw.</p>

<p align="center">
  <a href="https://inkrajs.github.io/">Playground</a> ·
  <a href="https://inkrajs.github.io/docs/getting-started">Documentation</a> ·
  <a href="https://www.npmjs.com/package/@inkra/react">npm</a>
</p>

A hand-drawn React component library with pencil lettering, textured strokes
and soft washes of color.

<p align="center">
  <a href="https://inkrajs.github.io/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./assets/preview-dark.png">
      <img src="./assets/preview-light.png" alt="Inkra form, calendar and journey map" width="1100">
    </picture>
  </a>
</p>

- **Pencil, down to the letters.** Handwritten text, paper texture and expressive lines.
- **Familiar interactions.** Type, select, copy and navigate with the keyboard.
- **Make it yours.** Customize colors, fonts and strokes, in light or dark.
- **Build beyond the basics.** Compose forms, layouts, maps and skill trees.

## Get started

```sh
npm install @inkra/react
```

```tsx
import '@inkra/react/styles.css';
import { Button } from '@inkra/react';

export function App() {
  return <Button>Save a little inspiration</Button>;
}
```

The stylesheet includes the default fonts and design tokens.
Explore and edit working examples in the [documentation](https://inkrajs.github.io/docs/getting-started).

## Explore

[Components](https://inkrajs.github.io/docs/components/button) ·
[Theming](https://inkrajs.github.io/docs/theming) ·
[Changelog](./CHANGELOG.md) ·
[Contributing](./CONTRIBUTING.md) ·
[Issues](https://github.com/inkrajs/inkra/issues)

[MIT license](./LICENSE). Fonts and other bundled assets retain their own
[licenses](./packages/inkra/THIRD_PARTY_NOTICES.md).
