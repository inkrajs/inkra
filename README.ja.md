<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/inkra-dark.png">
    <img src="./assets/inkra.png" alt="Inkra の鉛筆マーク" width="96" height="96">
  </picture>
</p>

<p align="center"><a href="./README.md">English</a> | <a href="./README.zh-CN.md">简体中文</a> | 日本語 | <a href="./README.ko.md">한국어</a> | <a href="./README.fr.md">Français</a></p>

<h1 align="center">Inkra</h1>

<p align="center">絵を描くように、インターフェースをつくる。</p>

<p align="center">
  <a href="https://inkrajs.github.io/">試してみる</a> ·
  <a href="https://inkrajs.github.io/docs/getting-started">ドキュメント</a> ·
  <a href="https://www.npmjs.com/package/@inkra/react">npm</a>
</p>

鉛筆のような文字、質感のある線、やわらかな色づかいを備えた、
手描き風の React コンポーネントライブラリ。

<p align="center">
  <a href="https://inkrajs.github.io/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./assets/preview-dark.png">
      <img src="./assets/preview-light.png" alt="Inkra のフォーム、カレンダー、旅の地図" width="1100">
    </picture>
  </a>
</p>

- **文字まで、鉛筆らしく。** 手書き文字、紙の質感、表情のある線。
- **いつもの操作を、そのまま。** 入力、選択、コピー、キーボード操作に対応。
- **自分らしい見た目に。** 色、フォント、筆触をカスタマイズ。ライト・ダーク両方に対応。
- **基本から、ひとつの体験へ。** フォーム、レイアウト、地図、スキルツリーを組み合わせる。

## 使いはじめる

お使いの AI に送ってください：

```text
次のガイドに従って、既存の構成とテーマを保ちながら、このプロジェクトに Inkra を導入してください：
https://inkrajs.github.io/start.md
```

手動でインストールする場合：

```sh
npm install @inkra/react
```

```tsx
import '@inkra/react/styles.css';
import { Button } from '@inkra/react';

export function App() {
  return <Button>ひらめきを残す</Button>;
}
```

スタイルシートには、標準フォントとデザイントークンが含まれています。
[ドキュメント](https://inkrajs.github.io/docs/getting-started)で、動くサンプルを試しながらコードを編集できます。

## もっと見る

[コンポーネント](https://inkrajs.github.io/docs/components/button) ·
[テーマ設定](https://inkrajs.github.io/docs/theming) ·
[AI 導入ガイド](https://inkrajs.github.io/start.md) ·
[変更履歴](./CHANGELOG.md) ·
[コントリビューション](./CONTRIBUTING.md) ·
[不具合・要望](https://github.com/inkrajs/inkra/issues)

[MIT ライセンス](./LICENSE)。同梱のフォントやその他の素材には、それぞれの
[ライセンス](./packages/inkra/THIRD_PARTY_NOTICES.md)が適用されます。
