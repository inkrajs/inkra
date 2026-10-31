<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/inkra-dark.png">
    <img src="./assets/inkra.png" alt="Logo au crayon d’Inkra" width="96" height="96">
  </picture>
</p>

<p align="center"><a href="./README.md">English</a> | <a href="./README.zh-CN.md">简体中文</a> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a> | Français</p>

<h1 align="center">Inkra</h1>

<p align="center">Créez votre interface comme un dessin.</p>

<p align="center">
  <a href="https://inkrajs.github.io/">Essayer</a> ·
  <a href="https://inkrajs.github.io/docs/getting-started">Documentation</a> ·
  <a href="https://www.npmjs.com/package/@inkra/react">npm</a>
</p>

Une bibliothèque de composants React au style dessiné à la main, avec des lettres
au crayon, des traits texturés et de douces touches de couleur.

<p align="center">
  <a href="https://inkrajs.github.io/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./assets/preview-dark.png">
      <img src="./assets/preview-light.png" alt="Formulaire, calendrier et carte de voyage Inkra" width="1100">
    </picture>
  </a>
</p>

- **Du crayon jusque dans les lettres.** Écriture manuscrite, grain du papier et traits expressifs.
- **Des interactions familières.** Saisie, sélection, copie et navigation au clavier.
- **Un style qui vous ressemble.** Personnalisez les couleurs, les polices et les traits, en clair comme en sombre.
- **Au-delà des composants de base.** Composez formulaires, mises en page, cartes et arbres de compétences.

## Bien démarrer

Envoyez ceci à votre assistant IA :

```text
Suis ce guide pour intégrer Inkra au projet actuel, en conservant sa structure et son thème :
https://inkrajs.github.io/start.md
```

Ou installez la bibliothèque manuellement :

```sh
npm install @inkra/react
```

```tsx
import '@inkra/react/styles.css';
import { Button } from '@inkra/react';

export function App() {
  return <Button>Garder une idée</Button>;
}
```

La feuille de style inclut les polices et les variables de design par défaut.
Essayez et modifiez des exemples interactifs dans la [documentation](https://inkrajs.github.io/docs/getting-started).

## Explorer

[Composants](https://inkrajs.github.io/docs/components/button) ·
[Thèmes](https://inkrajs.github.io/docs/theming) ·
[Guide de mise en place avec l’IA](https://inkrajs.github.io/start.md) ·
[Historique des versions](./CHANGELOG.md) ·
[Contribuer](./CONTRIBUTING.md) ·
[Signaler un problème](https://github.com/inkrajs/inkra/issues)

[Licence MIT](./LICENSE). Les polices et autres ressources fournies conservent leurs
[licences respectives](./packages/inkra/THIRD_PARTY_NOTICES.md).
