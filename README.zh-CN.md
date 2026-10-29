<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/inkra-dark.png">
    <img src="./assets/inkra.png" alt="Inkra 铅笔标志" width="96" height="96">
  </picture>
</p>

<p align="center"><a href="./README.md">English</a> | 简体中文</p>

<h1 align="center">Inkra</h1>

<p align="center">像画画一样搭建你的界面。</p>

<p align="center">
  <a href="https://inkrajs.github.io/">在线体验</a> ·
  <a href="https://inkrajs.github.io/docs/getting-started">使用文档</a> ·
  <a href="https://www.npmjs.com/package/@inkra/react">npm</a>
</p>

一个手绘风格的 React 组件库，带着铅笔文字、细腻笔触和轻轻的铺色。

<p align="center">
  <a href="https://inkrajs.github.io/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./assets/preview-dark.png">
      <img src="./assets/preview-light.png" alt="Inkra 表单、日历与行程地图" width="1100">
    </picture>
  </a>
</p>

- **笔触，一直细到文字。** 手写字、纸面纹理和自然的手绘线条。
- **操作还是熟悉的操作。** 正常输入、选择、复制和使用键盘。
- **留出你的风格。** 自定义颜色、字体和笔触，支持浅色与深色。
- **从基础组件搭到完整场景。** 表单、布局、地图，也可以是技能树。

## 开始使用

```sh
npm install @inkra/react
```

```tsx
import '@inkra/react/styles.css';
import { Button } from '@inkra/react';

export function App() {
  return <Button>存下一点灵感</Button>;
}
```

样式已包含默认字体和设计变量。
在[文档站](https://inkrajs.github.io/docs/getting-started)里调参数、看代码，试试实际效果。

## 继续探索

[组件](https://inkrajs.github.io/docs/components/button) ·
[主题定制](https://inkrajs.github.io/docs/theming) ·
[更新日志](./CHANGELOG.md) ·
[贡献指南](./CONTRIBUTING.md) ·
[问题反馈](https://github.com/inkrajs/inkra/issues)

[MIT 许可](./LICENSE)。字体与其他附带资源保留各自的
[许可声明](./packages/inkra/THIRD_PARTY_NOTICES.md)。
